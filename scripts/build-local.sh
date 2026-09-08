#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIRECTORY}/.." && pwd)"
ENV_LOCAL="${PROJECT_ROOT}/.env.local"

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

trim_whitespace() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "${value}"
}

load_local_environment() {
  if [[ ! -f "${ENV_LOCAL}" ]]; then
    echo "警告: ${ENV_LOCAL} が見つからないため、環境変数を展開せずに続行します。" >&2
    return
  fi

  local line
  local trimmed_line
  local key
  local value

  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%$'\r'}"
    trimmed_line="$(trim_whitespace "${line}")"

    if [[ -z "${trimmed_line}" || "${trimmed_line}" == \#* ]]; then
      continue
    fi

    if [[ ! "${trimmed_line}" =~ ^(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      echo "警告: ${ENV_LOCAL} の解釈できない行をスキップしました。" >&2
      continue
    fi

    key="${BASH_REMATCH[2]}"
    value="$(trim_whitespace "${BASH_REMATCH[3]}")"

    if [[ "${value}" =~ ^\".*\"$ ]] || [[ "${value}" =~ ^\'.*\'$ ]]; then
      value="${value:1:$((${#value} - 2))}"
    fi

    export "${key}=${value}"
  done < "${ENV_LOCAL}"
}

load_local_environment

if ! command -v eas >/dev/null 2>&1; then
  echo "エラー: eas コマンドが見つかりません。ローカルへ eas-cli をインストールしてPATHへ追加してください。" >&2
  exit 1
fi

build_platform() {
  local target_platform="$1"
  local artifacts_directory="${PROJECT_ROOT}/builds/${PROFILE}/${target_platform}"

  mkdir -p "${artifacts_directory}"
  echo "${target_platform}の${PROFILE}ビルドを開始します。成果物: ${artifacts_directory}"

  EAS_LOCAL_BUILD_ARTIFACTS_DIR="${artifacts_directory}" \
    eas build \
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
