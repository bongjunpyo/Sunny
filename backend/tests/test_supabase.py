import pytest

from api import supabase


@pytest.mark.parametrize("missing", ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"])
def test_missing_setting_fails_without_exposing_credentials(monkeypatch, missing):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    monkeypatch.delenv(missing)
    with pytest.raises(RuntimeError, match="서버 환경변수") as error:
        supabase.create_server_supabase_client()
    assert "sb_publishable_test" not in str(error.value)


def test_each_request_gets_client_without_persistent_session(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    created = []

    def capture(url, key, *, options):
        assert url == "https://example.supabase.co"
        assert key == "sb_publishable_test"
        assert options.auto_refresh_token is False
        assert options.persist_session is False
        client = object()
        created.append(client)
        return client

    monkeypatch.setattr(supabase, "create_client", capture)
    first = supabase.create_server_supabase_client()
    second = supabase.create_server_supabase_client()
    assert first is not second
    assert len(created) == 2
