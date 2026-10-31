# Render 영구 저장과 기존 기록 이전

운영 구성은 Starter 인스턴스 1개와 `/data`에 연결한 영구 디스크 1GB입니다. `DATA_FILE=/data/game.sqlite`, `SAVE_PERSISTENCE=persistent`, `COOKIE_SECURE=1`, `TRUST_PROXY=1`, 상태 확인 경로 `/healthz`를 사용합니다. 실제 요금은 Render 결제 화면에서 확인합니다. Pro 워크스페이스와 자동 확장은 필요하지 않습니다. `render.yaml`은 이 구성을 지정하지만 기존 서비스에 자동으로 디스크를 붙이거나 과거 DB를 이전하지는 않습니다.

## 기존 기록을 초기화하고 시작하는 경우

이 경로는 기존 계정·선수 슬롯·방·채팅·초대장을 모두 버리는 데 동의한 경우에만 사용합니다. 현재 서비스의 Compute를 Starter로 바꾸고 Disks에서 `/data`에 1GB 디스크를 연결합니다. Environment의 `DATA_FILE`을 `/data/game.sqlite`, `SAVE_PERSISTENCE`를 `persistent`로 설정하고 `STORAGE_MAINTENANCE`는 제거합니다. Health Check Path는 `/healthz`입니다.

기존 임시 DB를 복사하지 않으면 비어 있는 디스크에 새 DB가 만들어집니다. 기존 디스크에 이미 DB가 있다면 이 절차만으로는 삭제되지 않습니다. 코드에는 배포 때마다 DB를 지우는 동작을 넣지 않았습니다.

최초 관리자 가입을 위해 `FIRST_TEAM_ADMIN_INVITE`에 운영자가 생성한 무작위 24~128자 값을 설정합니다. 값을 공개하거나 저장소에 넣지 않습니다. 최종 배포가 정상 완료된 뒤 사이트에서 그 코드로 관리자 계정을 새로 만들고, 선수 슬롯을 등록한 다음 초대장을 발급합니다. 디스크와 환경 변수는 기존 수동 생성 서비스에 저장소 push만으로 적용되지 않으므로 대시보드에서 확인해야 합니다.

## 현재 계정과 시즌이 있는 경우

**현재 DB를 서버 밖에 백업하기 전에는 플랜 변경, 디스크 추가, 환경 변수 변경, 재배포를 실행하지 않습니다.** 임시 파일은 인스턴스 교체 시 사라질 수 있습니다. 유료 전환 뒤에 이전 무료 서버의 파일에 접근할 수 있다고 가정하면 안 됩니다.

서비스 대시보드 왼쪽의 Shell 또는 Connect → SSH에서 현재 실행 중인 서버에 접속 가능한지 먼저 확인합니다. 무료 인스턴스는 SSH를 지원하지 않습니다. 접근이 불가능하면 Render 지원에 현재 실행 인스턴스 DB를 회수할 방법이 있는지 문의해야 합니다. 현재 버전의 방 내보내기는 계정·전체 채팅·인증 세션을 포함한 DB 백업이 아닙니다. 이 제약을 해결하지 않고 전체 기록 보존을 보장할 수 없습니다.

기존 실행 서버에 이미 접근할 수 있다면 현재 `DATA_FILE` 위치를 확인하고 Node 24의 SQLite backup API로 스냅샷을 만듭니다. 최신 버전의 도구가 이미 설치된 서버에서는 다음을 사용할 수 있습니다.

```sh
node scripts/storage.mjs inspect /현재/경로/game.sqlite
node scripts/storage.mjs backup /현재/경로/game.sqlite /임시/경로/before-disk.sqlite
```

도구가 없는 이전 버전은 SQLite 온라인 백업으로 스냅샷을 만들 수 있습니다.

```sh
node --input-type=module -e 'import {DatabaseSync,backup} from "node:sqlite"; const db=new DatabaseSync(process.env.DATA_FILE,{readOnly:true}); try {await backup(db,"/tmp/first-team-before-disk.sqlite")} finally {db.close()}'
```

`DATA_FILE`이 실제 경로로 설정돼 있는지 확인한 뒤 실행합니다. 이 스냅샷을 지원되는 SSH 파일 전송 등으로 **서버 밖 개인 저장소에 내려받아 검증**해야 합니다. 같은 서버의 `/tmp`에만 남긴 백업은 보존되지 않습니다. DB에는 계정 인증 정보와 비공개 대화가 있으므로 공개 저장소나 채팅에 첨부하지 않습니다. 백업 시작 전에 참가자의 진행을 멈추고, 백업 후에도 이전 서버에 새 기록을 만들지 않도록 합니다.

## 백업 확보 후 이전

1. 유료 인스턴스와 `/data` 영구 디스크를 설정합니다. 인스턴스는 1개를 유지합니다.
2. 새 코드에 `STORAGE_MAINTENANCE=1`을 설정해 배포합니다. 이 모드는 앱과 API를 점검 중으로 표시하고 DB를 열거나 생성하지 않습니다. `/healthz`는 정상 응답합니다.
3. 확보한 스냅샷을 새 서버 `/data/import.sqlite`로 전송합니다. 서버가 점검 모드인 상태에서 다음을 실행합니다.

```sh
node scripts/storage.mjs inspect /data/import.sqlite
node scripts/storage.mjs restore /data/import.sqlite /data/game.sqlite
node scripts/storage.mjs inspect /data/game.sqlite
```

4. 백업과 복원본의 계정·방·메시지·초대장·세션 수를 비교합니다. 복원 도구는 대상 DB 또는 WAL/SHM이 이미 있으면 덮어쓰지 않습니다. 오류가 나면 기존 파일을 삭제하지 말고 원인을 확인합니다.
5. `STORAGE_MAINTENANCE`를 해제해 다시 배포하고 기존 계정 로그인, 시즌 날짜와 선수, 채팅, 초대장 상태를 확인합니다. 이후 재배포는 같은 `/data/game.sqlite`를 사용합니다. 최초 관리자 초대 코드도 기존 설정을 유지합니다.

## 신규 설치와 이후 백업

기존 데이터가 없는 신규 설치만 Blueprint로 바로 생성할 수 있습니다. 최초 관리자 설정은 [계정 안내](accounts.md)를 따릅니다. 이후에도 영구 디스크 삭제나 서비스 삭제는 별도 작업이므로 정기적으로 온라인 스냅샷을 서버 밖에 보관합니다. `npm run db:inspect -- 경로`, `npm run db:backup -- 원본 백업`, `npm run db:restore -- 백업 새대상` 명령도 사용할 수 있습니다.
