#!/usr/bin/env bash
# core/ に会社固有が漏れていないかを検査する。
# 1件でもヒットしたら分離に失敗している。機能を足すのではなく、分離をやり直すこと。
set -u

PATTERN='ライズ|ライズ・コンサルティング|RCG|NouScale|AlchTech|游ゴシック|株式会社|坂下|浦上'
TARGET="${1:-core}"

if [ ! -d "$TARGET" ]; then
  echo "skip: $TARGET が存在しません"
  exit 0
fi

HITS=$(grep -rniE "$PATTERN" "$TARGET" 2>/dev/null || true)

if [ -n "$HITS" ]; then
  echo "FAIL: $TARGET に会社固有語が混入しています"
  echo "$HITS"
  echo ""
  echo "対処: 該当箇所を org/org-profile.*.json へ移し、core からは差し込みスロット経由で参照すること。"
  exit 1
fi

echo "PASS: $TARGET に会社固有語の混入なし"
