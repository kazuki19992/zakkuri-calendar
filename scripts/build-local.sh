#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIRECTORY}/.." && pwd)"

print_usage() {
  echo "使用方法: ./scripts/build-local.sh <development|preview|production> [ios|android|all]" >&2
}

PROFILE="${1:-}"
PLATFORM="${2:-all}"

case "${PROFILE}" in
  development | preview | production) ;;
  *)
    echo "profileは development、preview、production のいずれかを指定してください。" >&2
    print_usage
    exit 1
    ;;
esac

case "${PLATFORM}" in
  ios | android | all) ;;
  *)
    echo "platformは ios、android、all のいずれかを指定してください。" >&2
    print_usage
    exit 1
    ;;
esac

build_platform() {
  local target_platform="$1"
  local artifacts_directory="${PROJECT_ROOT}/builds/${PROFILE}/${target_platform}"

  mkdir -p "${artifacts_directory}"
  echo "${target_platform}の${PROFILE}ビルドを開始します。成果物: ${artifacts_directory}"

  EAS_LOCAL_BUILD_ARTIFACTS_DIR="${artifacts_directory}" \
    npx eas-cli build \
      --platform "${target_platform}" \
      --profile "${PROFILE}" \
      --local
}

if [[ "${PLATFORM}" == "all" ]]; then
  build_platform ios
  build_platform android
else
  build_platform "${PLATFORM}"
fi
