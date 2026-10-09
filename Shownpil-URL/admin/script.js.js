async function saveUser() {

    const userId =
        document.getElementById("user-id").value.trim();

    const password =
        document.getElementById("user-password").value;

    const name =
        document.getElementById("user-name").value.trim();


    if (!userId || !password) {
        alert("사용자 ID와 비밀번호를 입력해주세요.");
        return;
    }


    try {

        const response = await fetch(
            "http://localhost:3000/create-user",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    userId: userId,
                    password: password,
                    name: name
                })
            }
        );


        const result = await response.json();


        if (!response.ok) {
            alert(result.error || "사용자 등록에 실패했습니다.");
            return;
        }


        alert("사용자가 등록되었습니다.");

        document.getElementById("user-id").value = "";
        document.getElementById("user-password").value = "";
        document.getElementById("user-name").value = "";

        document.getElementById("modal").style.display = "none";


    } catch (error) {

        console.error(error);

        alert("서버에 연결할 수 없습니다.");

    }
}