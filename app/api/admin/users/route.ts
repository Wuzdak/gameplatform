
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Не настроены серверные переменные Supabase.");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function authorize(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  const authorization = request.headers.get("authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return {
      supabase,
      user: null,
      response: NextResponse.json(
        { error: "Необходима авторизация." },
        { status: 401 }
      ),
    };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return {
      supabase,
      user: null,
      response: NextResponse.json(
        { error: "Недействительная сессия." },
        { status: 401 }
      ),
    };
  }

  const { data: admin, error: adminError } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminError) {
    return {
      supabase,
      user: null,
      response: NextResponse.json(
        { error: "Не удалось проверить права администратора." },
        { status: 500 }
      ),
    };
  }

  if (!admin) {
    return {
      supabase,
      user: null,
      response: NextResponse.json(
        { error: "Недостаточно прав." },
        { status: 403 }
      ),
    };
  }

  return {
    supabase,
    user: data.user,
    response: null,
  };
}

// Получение списка пользователей.

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize(request);

    if (auth.response) return auth.response;

    const { data, error } = await auth.supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const { data: admins, error: adminsError } = await auth.supabase
      .from("platform_admins")
      .select("user_id");

    if (adminsError) {
      return NextResponse.json(
        { error: adminsError.message },
        { status: 500 }
      );
    }

    const adminIds = new Set(
      (admins || []).map((admin) => admin.user_id)
    );

    const users = data.users.map((user) => ({
      id: user.id,
      email: user.email || null,
      full_name: user.user_metadata?.full_name || null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at || null,
      banned_until: user.banned_until || null,
      is_admin: adminIds.has(user.id),
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Admin users GET error:", error);

    return NextResponse.json(
      { error: "Внутренняя ошибка сервера." },
      { status: 500 }
    );
  }
}

// Управление аккаунтами.

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authorize(request);

    if (auth.response) return auth.response;

    const body = await request.json();

    const userId = body.userId;
    const action = body.action;

    const allowedActions = [
      "ban",
      "unban",
      "make_admin",
      "remove_admin",
    ];

    if (
      typeof userId !== "string" ||
      !allowedActions.includes(action)
    ) {
      return NextResponse.json(
        { error: "Некорректные параметры запроса." },
        { status: 400 }
      );
    }

    if (userId === auth.user!.id && action !== "make_admin") {
      return NextResponse.json(
        { error: "Нельзя изменять собственный аккаунт этим действием." },
        { status: 400 }
      );
    }

    const { data: targetAdmin, error: targetAdminError } =
      await auth.supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

    if (targetAdminError) {
      return NextResponse.json(
        { error: targetAdminError.message },
        { status: 500 }
      );
    }

    if (action === "ban") {
      if (targetAdmin) {
        return NextResponse.json(
          {
            error:
              "Сначала снимите с пользователя права администратора.",
          },
          { status: 400 }
        );
      }

      const duration = body.duration;

      if (!["24h", "7d", "30d"].includes(duration)) {
        return NextResponse.json(
          { error: "Выбери срок блокировки: 24 часа, 7 или 30 дней." },
          { status: 400 }
        );
      }

      const { error } = await auth.supabase.auth.admin.updateUserById(
        userId,
        { ban_duration: duration }
      );

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Аккаунт заблокирован.",
      });
    }

    if (action === "unban") {
      const { error } = await auth.supabase.auth.admin.updateUserById(
        userId,
        { ban_duration: "none" }
      );

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Блокировка снята.",
      });
    }

    if (action === "make_admin") {
      if (targetAdmin) {
        return NextResponse.json({
          success: true,
          message: "Пользователь уже является администратором.",
        });
      }

      const { error } = await auth.supabase
        .from("platform_admins")
        .insert({ user_id: userId });

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Права администратора выданы.",
      });
    }

    if (action === "remove_admin") {
      if (!targetAdmin) {
        return NextResponse.json({
          success: true,
          message: "Пользователь не является администратором.",
        });
      }

      const { data: admins, error: adminsError } =
        await auth.supabase
          .from("platform_admins")
          .select("user_id");

      if (adminsError) {
        return NextResponse.json(
          { error: adminsError.message },
          { status: 500 }
        );
      }

      if ((admins || []).length <= 1) {
        return NextResponse.json(
          { error: "Нельзя снять права с последнего администратора." },
          { status: 400 }
        );
      }

      const { error } = await auth.supabase
        .from("platform_admins")
        .delete()
        .eq("user_id", userId);

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Права администратора сняты.",
      });
    }

    return NextResponse.json(
      { error: "Неизвестное действие." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Admin users PATCH error:", error);

    return NextResponse.json(
      { error: "Внутренняя ошибка сервера." },
      { status: 500 }
    );
  }
}
