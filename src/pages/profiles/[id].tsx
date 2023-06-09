import React from "react";
import type { NextPage } from "next";
import type { GetStaticPropsContext } from "next";
import Head from "next/head";
import type { GetStaticPaths, InferGetStaticPropsType } from "next";
import { ssgHelper } from "~/server/api/ssgHelper";
import { api } from "~/utils/api";
import ErrorPage from "next/error";
import Link from "next/link";
import IconHoverEffect from "~/components/IconHoverEffect";
import { VscArrowLeft } from "react-icons/vsc";
import ProfileImage from "~/components/ProfileImage";
import InfiniteTweetList from "~/components/InfiniteTweetList";
import Button from "~/components/Button";
import { useSession } from "next-auth/react";

const ProfilePage: NextPage<InferGetStaticPropsType<typeof getStaticProps>> = ({
  id,
}) => {
  const { data: profile } = api.profile.getById.useQuery({ id });
  const tweets = api.tweet.infiniteProfileFeed.useInfiniteQuery(
    { userId: id },
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );
  const trpcUtils = api.useContext();

  const toggleFollow = api.profile.toggleFollow.useMutation({
    onSuccess: ({ addedFollow }) => {
      trpcUtils.profile.getById.setData({ id }, (oldData) => {
        if (oldData == null) return;

        const countModifier = addedFollow ? 1 : -1;
        return {
          ...oldData,
          isFollowing: addedFollow,
          followerCount: oldData.followersCount + countModifier,
        };
      });
    },
  });

  if (profile == null || profile.name == null)
    return <ErrorPage statusCode={404} />;
  return (
    <>
      <Head>
        <title>{`sharex. ${profile.name}`}</title>
      </Head>
      <header className=" sticky top-0 z-10 flex items-center border-b bg-white px-4 py-2 ">
        <Link href=".." className="mr-2">
          <IconHoverEffect>
            <VscArrowLeft className="h-6 w-6"></VscArrowLeft>
          </IconHoverEffect>
        </Link>
        <ProfileImage
          src={profile.image}
          className="mr-1 flex-shrink-0"
        ></ProfileImage>
        <div className="ml-1 flex-grow">
          <h1 className="text-lg font-bold">{profile.name}</h1>
          <div className="text-gray-500">
            {profile.tweetsCount}
            {getPlural(profile.tweetsCount, "tweet", "tweets")}
            {"  "}
            {profile.followsCount}
            {getPlural(profile.followersCount, "follower", "followers")}
            {"  "}
            {profile.followersCount}following
          </div>
        </div>
        <FollowButton
          userId={id}
          isFollowing={profile.isFollowing}
          isLoading={toggleFollow.isLoading}
          onClick={() => {
            toggleFollow.mutate({ userId: id });
          }}
        />
      </header>
      <main>
        <InfiniteTweetList
          tweets={tweets.data?.pages.flatMap((page) => page.tweets)}
          isError={tweets.isError}
          isLoading={tweets.isLoading}
          hasMore={tweets.hasNextPage || false}
          fetchNewTweets={tweets.fetchNextPage}
        />
      </main>
    </>
  );
};
function FollowButton({
  userId,
  isFollowing,
  isLoading,
  onClick,
}: {
  userId: string;
  isFollowing: boolean;
  isLoading: boolean;
  onClick: () => void;
}) {
  const session = useSession();
  if (session.status !== "authenticated" || session.data.user.id === userId)
    return null;

  return (
    <Button disabled={isLoading} onClick={onClick} small gray={isFollowing}>
      {isFollowing ? "Unfollow" : "Follow"}
    </Button>
  );
}
export const getStaticPaths: GetStaticPaths = () => {
  return {
    paths: [],
    fallback: "blocking",
  };
};

const pluralRules = new Intl.PluralRules();
function getPlural(number: number, singular: string, plural: string) {
  return pluralRules.select(number) === "one" ? singular : plural;
}

export async function getStaticProps(
  context: GetStaticPropsContext<{ id: string }>
) {
  const id = context.params?.id;
  if (id == null) {
    return {
      redirect: {
        destination: "/",
      },
    };
  }
  const ssg = ssgHelper();
  await ssg.profile.getById.prefetch({ id });
  return {
    props: {
      id,
      trpcState: ssg.dehydrate(),
    },
  };
}

export default ProfilePage;
