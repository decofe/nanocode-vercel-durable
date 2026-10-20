const token = process.env.CHAT_TOKEN;

export const authorize = token
  ? async (request: Request) => {
    if (request.headers.get("authorization") !== `Bearer ${token}`) throw new Response("unauthorized", { status: 401 });
  }
  : undefined;
