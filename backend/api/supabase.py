"""기존 TypeScript 연결 기반을 대체하는 요청별 Supabase 클라이언트."""

import os

from supabase import Client, ClientOptions, create_client


def create_server_supabase_client() -> Client:
    url = os.environ.get("SUPABASE_URL", "").strip()
    publishable_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip()
    if not url or not publishable_key:
        raise RuntimeError("Supabase 서버 환경변수가 설정되지 않았습니다.")

    # 클라이언트를 전역 공유하면 서로 다른 사용자의 세션이 섞일 수 있다.
    # 사용자 JWT 검증·주입과 쿠키 처리는 #70 합의 후 구현한다.
    return create_client(
        url,
        publishable_key,
        options=ClientOptions(auto_refresh_token=False, persist_session=False),
    )
