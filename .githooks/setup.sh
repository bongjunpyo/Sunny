#!/bin/sh
# 클론 후 한 번 실행하십시오.
#   macOS:       sh .githooks/setup.sh
#   Windows:     git config core.hooksPath .githooks   (PowerShell 에서 이 한 줄)
git config core.hooksPath .githooks
echo "훅을 켰습니다. 이제 main 직접 push · force push · 비밀정보 커밋이 막힙니다."
echo "확인: git config --get core.hooksPath   ->  .githooks"
