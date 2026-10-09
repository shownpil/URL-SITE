const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const fs = require("fs");
const crypto = require("crypto");

console.log("SHONPIL URL SERVER LOADED");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ==========================
// 경로
// ==========================

const SITE_ROOT =
    path.join(__dirname, "..");

const ADMIN_ROOT =
    path.join(SITE_ROOT, "admin");
    const SHORT_URL_FILE = path.join(__dirname, "shorturls.json");

if (!fs.existsSync(SHORT_URL_FILE)) {
  fs.writeFileSync(
    SHORT_URL_FILE,
    JSON.stringify({}, null, 2),
    "utf8"
  );
}


// ==========================
// Supabase
// ==========================

const SUPABASE_URL =
    "https://inqcegegbcntdipksknb.supabase.co";

// 여기에 기존 Supabase Secret Key 입력
const SUPABASE_SECRET_KEY =
    "SECRET_KEY";

const SUPABASE_PUBLISHABLE_KEY =
    "PUBLISHABLE_KEY";


// ==========================
// 관리자 Auth UID
// ==========================

const ADMIN_USER_ID =
    "74d98c16-8490-4844-94d1-b1e00d850e25";


// ==========================
// Supabase 관리자 클라이언트
// ==========================

const supabase =
    createClient(
        SUPABASE_URL,
        SUPABASE_SECRET_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            }
        }
    );


// ==========================
// Supabase 로그인 클라이언트
// ==========================

const authClient =
    createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            }
        }
    );


// ==========================
// 쿠키 읽기
// ==========================

function getCookies(req) {

    const cookies = {};

    const header =
        req.headers.cookie;

    if (!header) {
        return cookies;
    }

    header
        .split(";")
        .forEach(item => {

            const parts =
                item.trim().split("=");

            const name =
                parts.shift();

            const value =
                parts.join("=");

            cookies[name] =
                decodeURIComponent(
                    value || ""
                );

        });

    return cookies;
}


// ==========================
// 로그인 쿠키 설정
// ==========================

function setLoginCookies(
    res,
    session
) {

    res.setHeader(
        "Set-Cookie",
        [
            `shonpil_access=${encodeURIComponent(session.access_token)}; HttpOnly; Path=/; SameSite=Lax`,
            `shonpil_refresh=${encodeURIComponent(session.refresh_token)}; HttpOnly; Path=/; SameSite=Lax`
        ]
    );

}


// ==========================
// 메인 사이트
// ==========================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            SITE_ROOT,
            "index.html"
        )
    );

});


app.get("/style.css", (req, res) => {

    res.sendFile(
        path.join(
            SITE_ROOT,
            "style.css"
        )
    );

});


// ==================================================
// 로그인
// 관리자 + 사용자 공통 로그인
// ==================================================

app.post("/login", async (req, res) => {

    try {

        const {
            userId,
            password
        } = req.body;


        console.log(
            "LOGIN BODY:",
            req.body
        );


        // ==========================
        // 입력 확인
        // ==========================

        if (
            !userId ||
            !password
        ) {

            return res.redirect(
                "/?error=empty"
            );

        }


        // ==================================================
        // STEP 1
        // 관리자 로그인
        //
        // 관리자는 기존처럼 이메일을 그대로 사용
        // ==================================================

        console.log(
            "TRY ADMIN LOGIN"
        );


        const adminLogin =
            await authClient.auth
                .signInWithPassword({

                    email:
                        userId,

                    password:
                        password

                });


        // ==========================
        // 관리자 로그인 성공
        // ==========================

        if (
            !adminLogin.error &&
            adminLogin.data &&
            adminLogin.data.user &&
            adminLogin.data.session
        ) {

            console.log(
                "AUTH LOGIN SUCCESS:",
                adminLogin.data.user.id
            );


            // ==========================
            // 관리자 UID 확인
            // ==========================

            if (
                adminLogin.data.user.id ===
                ADMIN_USER_ID
            ) {

                console.log(
                    "ADMIN LOGIN SUCCESS"
                );


                setLoginCookies(
                    res,
                    adminLogin.data.session
                );


                return res.redirect(
                    "/admin/index.html"
                );

            }


            // ==================================================
            // 이메일 로그인 자체는 성공했지만
            // 관리자 UID가 아닌 경우
            //
            // 여기서는 아직 사용자로 확정하지 않음.
            // 아래에서 user_profiles 확인.
            // ==================================================

            console.log(
                "AUTH USER IS NOT ADMIN:",
                adminLogin.data.user.id
            );


            const {
                data: profile,
                error: profileError
            } =
                await supabase
                    .from("user_profiles")
                    .select(
                        "id, user_id, name, active"
                    )
                    .eq(
                        "id",
                        adminLogin.data.user.id
                    )
                    .maybeSingle();


            if (
                profileError
            ) {

                console.log(
                    "USER PROFILE ERROR:",
                    profileError.message
                );

                return res.redirect(
                    "/?error=user"
                );

            }


            if (
                !profile
            ) {

                console.log(
                    "USER PROFILE NOT FOUND"
                );

                return res.redirect(
                    "/?error=login"
                );

            }


            if (
                !profile.active
            ) {

                console.log(
                    "INACTIVE USER:",
                    profile.user_id
                );

                return res.redirect(
                    "/?error=inactive"
                );

            }


            // ==========================
            // 사용자 로그인 성공
            // ==========================

            setLoginCookies(
                res,
                adminLogin.data.session
            );


            console.log(
                "USER LOGIN SUCCESS:",
                profile.user_id
            );


            return res.redirect(
                "/user/index.html"
            );

        }


        // ==================================================
        // STEP 2
        // 관리자 이메일 로그인 실패
        //
        // 사용자 ID 방식으로 다시 시도
        // ==================================================

        console.log(
            "ADMIN LOGIN FAILED"
        );


        // ==========================
        // 사용자 ID 검증
        // ==========================

        if (
            !/^[A-Za-z0-9_-]+$/.test(userId)
        ) {

            console.log(
                "INVALID USER ID FORMAT"
            );

            return res.redirect(
                "/?error=login"
            );

        }


        // ==========================
        // 사용자 ID → Auth 이메일
        // ==========================

        const encodedUserId =
            Buffer
                .from(userId)
                .toString("base64url");


        const projectHost =
            new URL(
                SUPABASE_URL
            ).hostname;


        const userAuthEmail =
            `${encodedUserId}@${projectHost}`;


        console.log(
            "TRY USER LOGIN:",
            userAuthEmail
        );


        // ==========================
        // 사용자 Auth 로그인
        // ==========================

        const userLogin =
            await authClient.auth
                .signInWithPassword({

                    email:
                        userAuthEmail,

                    password:
                        password

                });


        if (
            userLogin.error ||
            !userLogin.data ||
            !userLogin.data.user ||
            !userLogin.data.session
        ) {

            console.log(
                "USER LOGIN ERROR:",
                userLogin.error?.message
            );

            return res.redirect(
                "/?error=login"
            );

        }


        console.log(
            "USER AUTH LOGIN SUCCESS:",
            userLogin.data.user.id
        );


        // ==================================================
        // STEP 3
        // user_profiles 확인
        // ==================================================

        const {
            data: userProfile,
            error: userProfileError
        } =
            await supabase
                .from("user_profiles")
                .select(
                    "id, user_id, name, active"
                )
                .eq(
                    "id",
                    userLogin.data.user.id
                )
                .maybeSingle();


        if (
            userProfileError
        ) {

            console.log(
                "USER PROFILE ERROR:",
                userProfileError.message
            );

            return res.redirect(
                "/?error=user"
            );

        }


        if (
            !userProfile
        ) {

            console.log(
                "USER PROFILE NOT FOUND:",
                userLogin.data.user.id
            );

            return res.redirect(
                "/?error=user"
            );

        }


        // ==========================
        // 관리자 UID가 혹시 사용자 DB에
        // 들어가 있더라도 관리자 페이지로 보냄
        // ==========================

        if (
            userProfile.id === ADMIN_USER_ID
        ) {

            setLoginCookies(
                res,
                userLogin.data.session
            );


            console.log(
                "ADMIN LOGIN SUCCESS"
            );


            return res.redirect(
                "/admin/index.html"
            );

        }


        // ==========================
        // 비활성화 사용자
        // ==========================

        if (
            !userProfile.active
        ) {

            console.log(
                "INACTIVE USER:",
                userProfile.user_id
            );

            return res.redirect(
                "/?error=inactive"
            );

        }


        // ==========================
        // 사용자 로그인 성공
        // ==========================

        setLoginCookies(
            res,
            userLogin.data.session
        );


        console.log(
            "USER LOGIN SUCCESS:",
            userProfile.user_id
        );


        return res.redirect(
            "/user/index.html"
        );


    } catch (error) {

        console.error(
            "LOGIN SERVER ERROR:",
            error
        );

        return res.redirect(
            "/?error=server"
        );

    }

});


// ==========================
// 로그아웃
// ==========================

app.get("/logout", (req, res) => {

    res.setHeader(
        "Set-Cookie",
        [
            "shonpil_access=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
            "shonpil_refresh=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"
        ]
    );


    res.redirect("/");

});

// ==========================
// URL 변환
// ==========================

function loadShortUrls() {
  try {
    const data = fs.readFileSync(SHORT_URL_FILE, "utf8");

    if (!data.trim()) {
      return {};
    }

    return JSON.parse(data);
  } catch (error) {
    console.error("SHORT URL FILE READ ERROR:", error);
    return {};
  }
}

function saveShortUrls(data) {
  fs.writeFileSync(
    SHORT_URL_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

function generateShortCode() {
  return crypto.randomBytes(4).toString("base64url").slice(0, 6);
}


// ==========================
// URL 변환 요청
// ==========================

app.post("/api/convert-url", requireUser, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: "URL을 입력해주세요."
      });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({
        error: "올바른 URL을 입력해주세요."
      });
    }

    if (
      parsedUrl.protocol !== "http:" &&
      parsedUrl.protocol !== "https:"
    ) {
      return res.status(400).json({
        error: "HTTP 또는 HTTPS URL만 사용할 수 있습니다."
      });
    }

    const shortUrls = loadShortUrls();

    let code;

    do {
      code = generateShortCode();
    } while (shortUrls[code]);

    shortUrls[code] = url;

    saveShortUrls(shortUrls);

    const shortUrl =
      `${req.protocol}://${req.get("host")}/${code}`;

    console.log("URL CONVERTED:");
    console.log("ORIGINAL:", url);
    console.log("SHORT:", shortUrl);

    return res.json({
      success: true,
      shortUrl: shortUrl,
      code: code
    });

  } catch (error) {
    console.error("URL CONVERT ERROR:", error);

    return res.status(500).json({
      error: "URL 변환 중 오류가 발생했습니다."
    });
  }
});

// ==================================================
// 관리자 인증
// ==================================================

async function requireAdmin(
    req,
    res,
    next
) {

    try {

        const cookies =
            getCookies(req);


        const token =
            cookies.shonpil_access;


        if (!token) {

            if (
                req.path === "/admin" ||
                req.path === "/admin/index.html"
            ) {

                return res.redirect("/");

            }


            return res.status(401).json({
                error:
                    "로그인이 필요합니다."
            });

        }


        const {
            data,
            error
        } =
            await supabase.auth
                .getUser(token);


        if (
            error ||
            !data.user
        ) {

            return res.status(401).json({
                error:
                    "로그인이 만료되었습니다."
            });

        }


        if (
            data.user.id !==
            ADMIN_USER_ID
        ) {

            return res.status(403).json({
                error:
                    "관리자 권한이 없습니다."
            });

        }


        req.admin =
            data.user;


        next();

    } catch (error) {

        console.error(
            "ADMIN AUTH ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "관리자 인증 중 오류가 발생했습니다."
        });

    }

}


// ==================================================
// 사용자 인증
// ==================================================

async function requireUser(
    req,
    res,
    next
) {

    try {

        const cookies =
            getCookies(req);


        const token =
            cookies.shonpil_access;


        if (!token) {

            return res.redirect("/");

        }


        const {
            data,
            error
        } =
            await supabase.auth
                .getUser(token);


        if (
            error ||
            !data.user
        ) {

            return res.redirect("/");

        }


        // ==========================
        // 관리자 계정
        // ==========================

        if (
            data.user.id ===
            ADMIN_USER_ID
        ) {

            return res.redirect(
                "/admin/index.html"
            );

        }


        // ==========================
        // 사용자 프로필
        // ==========================

        const {
            data: profile,
            error: profileError
        } =
            await supabase
                .from("user_profiles")
                .select(
                    "id, user_id, name, active"
                )
                .eq(
                    "id",
                    data.user.id
                )
                .maybeSingle();


        if (
            profileError ||
            !profile
        ) {

            return res.redirect(
                "/?error=user"
            );

        }


        if (
            !profile.active
        ) {

            return res.redirect(
                "/?error=inactive"
            );

        }


        req.user =
            data.user;


        req.profile =
            profile;


        next();

    } catch (error) {

        console.error(
            "USER AUTH ERROR:",
            error
        );

        return res.redirect(
            "/?error=server"
        );

    }

}


// ==================================================
// 관리자 페이지
// ==================================================

app.get(
    "/admin",
    requireAdmin,
    (req, res) => {

        res.sendFile(
            path.join(
                ADMIN_ROOT,
                "index.html"
            )
        );

    }
);


app.get(
    "/admin/index.html",
    requireAdmin,
    (req, res) => {

        res.sendFile(
            path.join(
                ADMIN_ROOT,
                "index.html"
            )
        );

    }
);


app.get(
    "/admin/style.css",
    (req, res) => {

        res.sendFile(
            path.join(
                ADMIN_ROOT,
                "style.css"
            )
        );

    }
);


// ==================================================
// 사용자 페이지
// ==================================================

app.get(
    "/user",
    requireUser,
    (req, res) => {

        res.sendFile(
            path.join(
                SITE_ROOT,
                "user",
                "index.html"
            )
        );

    }
);


app.get(
    "/user/index.html",
    requireUser,
    (req, res) => {

        res.sendFile(
            path.join(
                SITE_ROOT,
                "user",
                "index.html"
            )
        );

    }
);


app.get(
    "/user/style.css",
    (req, res) => {

        res.sendFile(
            path.join(
                SITE_ROOT,
                "user",
                "style.css"
            )
        );

    }
);


// ==================================================
// 사용자 목록
// ==================================================

app.get(
    "/users",
    requireAdmin,
    async (req, res) => {

        const {
            data,
            error
        } =
            await supabase
                .from("user_profiles")
                .select(
                    "id, user_id, name, active, created_at"
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error) {

            return res.status(400).json({
                error:
                    error.message
            });

        }


        res.json(data);

    }
);


// ==================================================
// 사용자 등록
// ==================================================

app.post(
    "/create-user",
    requireAdmin,
    async (req, res) => {

        const {
            userId,
            password,
            name
        } = req.body;


        if (
            !userId ||
            !password
        ) {

            return res.status(400).json({
                error:
                    "사용자 ID와 비밀번호를 입력해주세요."
            });

        }


        if (
            !/^[A-Za-z0-9_-]+$/.test(userId)
        ) {

            return res.status(400).json({
                error:
                    "사용자 ID는 영문, 숫자, _ , - 만 사용할 수 있습니다."
            });

        }


        const projectHost =
            new URL(
                SUPABASE_URL
            ).hostname;


        const authEmail =
            `${Buffer
                .from(userId)
                .toString("base64url")}@${projectHost}`;


        console.log(
            "CREATED USER AUTH EMAIL:",
            authEmail
        );


        const {
            data,
            error
        } =
            await supabase.auth.admin
                .createUser({

                    email:
                        authEmail,

                    password:
                        password,

                    email_confirm:
                        true

                });


        if (error) {

            return res.status(400).json({
                error:
                    error.message
            });

        }


        const {
            error: profileError
        } =
            await supabase
                .from("user_profiles")
                .insert({

                    id:
                        data.user.id,

                    user_id:
                        userId,

                    name:
                        name || null,

                    active:
                        true

                });


        if (profileError) {

            await supabase.auth.admin
                .deleteUser(
                    data.user.id
                );


            return res.status(400).json({
                error:
                    profileError.message
            });

        }


        res.json({
            success:
                true
        });

    }
);


// ==================================================
// 사용자 정보 수정
// ==================================================

app.post(
    "/update-user",
    requireAdmin,
    async (req, res) => {

        const {
            id,
            name
        } = req.body;


        const {
            error
        } =
            await supabase
                .from("user_profiles")
                .update({
                    name:
                        name || null
                })
                .eq(
                    "id",
                    id
                );


        if (error) {

            return res.status(400).json({
                error:
                    error.message
            });

        }


        res.json({
            success:
                true
        });

    }
);


// ==================================================
// 비밀번호 변경
// ==================================================

app.post(
    "/change-password",
    requireAdmin,
    async (req, res) => {

        const {
            id,
            password
        } = req.body;


        if (
            !password ||
            password.length < 6
        ) {

            return res.status(400).json({
                error:
                    "비밀번호는 6자 이상이어야 합니다."
            });

        }


        const {
            error
        } =
            await supabase.auth.admin
                .updateUserById(
                    id,
                    {
                        password:
                            password
                    }
                );


        if (error) {

            return res.status(400).json({
                error:
                    error.message
            });

        }


        res.json({
            success:
                true
        });

    }
);


// ==================================================
// 활성화 / 비활성화
// ==================================================

app.post(
    "/toggle-user",
    requireAdmin,
    async (req, res) => {

        const {
            id,
            active
        } = req.body;


        const {
            error
        } =
            await supabase
                .from("user_profiles")
                .update({
                    active:
                        !!active
                })
                .eq(
                    "id",
                    id
                );


        if (error) {

            return res.status(400).json({
                error:
                    error.message
            });

        }


        res.json({
            success:
                true
        });

    }
);


// ==================================================
// 사용자 삭제
// ==================================================

app.post(
    "/delete-user",
    requireAdmin,
    async (req, res) => {

        const {
            id
        } = req.body;


        const {
            error: authError
        } =
            await supabase.auth.admin
                .deleteUser(id);


        if (authError) {

            return res.status(400).json({
                error:
                    authError.message
            });

        }


        const {
            error: profileError
        } =
            await supabase
                .from("user_profiles")
                .delete()
                .eq(
                    "id",
                    id
                );


        if (profileError) {

            return res.status(400).json({
                error:
                    profileError.message
            });

        }


        res.json({
            success:
                true
        });

    }
);

// ==========================
// 짧은 URL 접속
// ==========================

app.get("/:code", (req, res) => {
  try {
    const code = req.params.code;

    const shortUrls = loadShortUrls();
    const originalUrl = shortUrls[code];

    if (!originalUrl) {
      return res.status(404).send("존재하지 않는 짧은 URL입니다.");
    }

    console.log("SHORT URL REDIRECT:");
    console.log("CODE:", code);
    console.log("TARGET:", originalUrl);

    return res.redirect(originalUrl);

  } catch (error) {
    console.error("SHORT URL REDIRECT ERROR:", error);

    return res.status(500).send(
      "짧은 URL 처리 중 오류가 발생했습니다."
    );
  }
});

// ==================================================
// 서버 실행
// ==================================================

app.listen(
    3001,
    () => {

        console.log(
            "Server running: http://localhost:3001"
        );

    }
);