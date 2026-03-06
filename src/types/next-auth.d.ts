import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      nickName?: string | null;
    };
  }

  interface User {
    role?: string;
    nickName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    nickName?: string;
  }
}
