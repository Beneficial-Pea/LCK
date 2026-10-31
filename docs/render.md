# Render 무료 체험 배포

이 설정은 결제 없이 먼저 플레이해 볼 수 있도록 `plan: free`를 선택합니다. **무료 인스턴스의 파일은 영구 저장이 아닙니다. 서비스 재시작·재배포·중지 시 선수·슬롯·시즌·채팅이 사라질 수 있습니다.** 장기 플레이에는 유료 인스턴스와 영구 디스크를 설정해야 합니다. GitHub의 소스는 배포가 다시 이루어져도 유지됩니다.

## 웹 화면으로 배포

1. [Render 대시보드](https://dashboard.render.com/)에서 **New + → Web Service**를 선택합니다.
2. **Git Provider**에서 GitHub를 연결하고 `Beneficial-Pea/LCK` 저장소를 선택합니다. 목록에 없다면 GitHub 앱의 저장소 접근 권한에서 이 저장소를 허용합니다.
3. 이름은 원하는 이름, Branch는 `main`, Language/Runtime은 **Docker**, Instance Type은 **Free**로 설정합니다. Root Directory는 비워 둡니다. Dockerfile은 저장소 루트의 `Dockerfile`입니다.
4. Environment에 `SAVE_PERSISTENCE=ephemeral`을 추가합니다. `COOKIE_SECURE=1`과 `DATA_FILE=/data/game.sqlite`는 Dockerfile에 기본 설정되어 있습니다. `PORT`는 Render가 제공하므로 직접 고정하지 않습니다. 영구 디스크는 무료 체험에 추가하지 않습니다.
5. **Deploy Web Service**를 누릅니다. 로그의 `FIRST TEAM listening on port ...`와 Render의 정상 상태를 기다립니다.
6. 서비스 화면에 표시된 `https://…onrender.com` 주소를 엽니다. 다른 참가자에게 같은 주소와 방 코드를 함께 전달합니다. 최초 접속이나 무료 서비스가 유휴 상태에서 깨어날 때는 로딩에 시간이 걸릴 수 있습니다.

`render.yaml`을 적용하려면 **New + → Blueprint**에서 같은 저장소와 `main`을 선택합니다. 명시된 Free 플랜과 환경 변수를 확인하고 생성합니다. Blueprint도 무료 인스턴스에 영구 저장을 제공하지는 않습니다.

## 장기 플레이로 전환

결제 전에 Render의 현재 요금을 확인합니다. 사용자가 유료 이용을 선택한 뒤에만 인스턴스 종류를 변경하고 영구 디스크를 추가하세요. 디스크 마운트 경로는 `/data`, `DATA_FILE=/data/game.sqlite`, `SAVE_PERSISTENCE=persistent`로 설정합니다. 인스턴스는 1개로 유지합니다. 디스크를 붙이는 것만으로 무료 인스턴스의 이전 DB가 자동 이전되지는 않습니다.

배포 계정이나 DB의 비밀번호를 채팅에 공유할 필요는 없습니다. GitHub 연결은 Render의 로그인 화면에서 진행합니다. 배포 후 실제 HTTPS 화면 열기, 행동 제출, 서로 다른 브라우저의 방 동기화를 확인하세요. 이 문서는 배포 절차이며, 공개 서비스 생성이 성공했다는 증거는 아닙니다.
