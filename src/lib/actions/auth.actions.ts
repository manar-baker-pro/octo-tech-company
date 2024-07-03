"use server";
import { getServerSession } from "next-auth/next";
import { Account, Profile } from "next-auth";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { nextauthOptions } from "../nextAuth-options";
import connectDB from "../mongodb";
import User from "../models/User";
export async function getUserSession() {
  const session = await getServerSession(nextauthOptions);
  return { session };
}

interface ExtendedProfile extends Profile {
  picture?: string;
}

interface SignInWithOauthParams {
  account: Account;
  profile: ExtendedProfile;
}

export async function signInWithOauth({
  account,
  profile,
}: SignInWithOauthParams) {
  // console.log({account, profile})
  connectDB();

  const user = await User.findOne({ email: profile.email });

  if (user) return true;

  const newUser = new User({
    name: profile.name,
    email: profile.email,
    image: profile.picture,
    provider: account.provider,
  });

  // console.log(newUser)
  await newUser.save();

  return true;
}

interface GetUserByEmailParams {
  email: string;
}

export async function getUserByEmail({ email }: GetUserByEmailParams) {
  connectDB();

  const user = await User.findOne({ email }).select("-password");

  if (!user) {
    throw new Error("User does not exist!");
  }

  // console.log({user})
  return { ...user, _id: user._id.toString() };
}

export interface UpdateUserProfileParams {
  name: string;
}

export async function updateUserProfile({ name }: UpdateUserProfileParams) {
  const session = await getServerSession(nextauthOptions);
  // console.log(session)

  connectDB();

  try {
    if (!session) {
      throw new Error("Unauthorization!");
    }

    const user = await User.findByIdAndUpdate(
      session?.user?._id,
      {
        name,
      },
      { new: true }
    ).select("-password");

    if (!user) {
      throw new Error("User does not exist!");
    }

    return { success: true };
  } catch (error) {
    redirect(`/error?error=${(error as Error).message}`);
  }
}

interface SignInWithCredentialsParams {
  email: string;
  password: string;
}

export async function signInWithCredentials({
  email,
  password,
}: SignInWithCredentialsParams) {
  connectDB();

  const user = await User.findOne({ email });

  if (!user || !user.password) {
    throw new Error("Invalid email or password!");
  }

  const passwordIsValid = bcrypt.compare(password, user.password);

  if (!passwordIsValid) {
    throw new Error("Invalid email or password");
  }

  return { ...user.toObject(), _id: user._id.toString() };
}

export interface ChangeUserPasswordParams {
  oldPassword: string;
  newPassword: string;
}

export async function changeUserPassword({
  oldPassword,
  newPassword,
}: ChangeUserPasswordParams) {
  const session = await getServerSession(nextauthOptions);
  // console.log(session)

  connectDB();
  console.log("=========after connect db");
  try {
    if (!session) {
      throw new Error("Unauthorization!");
    }

    if (session?.user?.provider !== "credentials") {
      throw new Error(
        `Signed in via ${session?.user?.provider}. Changes not allowed with this method.`
      );
    }
    console.log("=========before findById ");

    const user = await User.findById(session?.user?._id);
    console.log("=========after findById ");

    if (!user || !user.password) {
      throw new Error("User does not exist!");
    }

    const passwordIsValid = await bcrypt.compare(oldPassword, user.password);

    if (!passwordIsValid) {
      throw new Error("Incorrect old password.");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
    });

    return { success: true };
  } catch (error) {
    redirect(`/error?error=${(error as Error).message}`);
  }
}
