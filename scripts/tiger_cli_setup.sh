#!/bin/bash
# https://github.com/murrayju/build-strap-cli/blob/b2620ebcceffe0a905a0aa9b49b871aec6b4e6e8/bs#L17
# Logging functions
log_info() { echo -e "${BLUE}ℹ${NC} $1" >&2; }
log_success() { echo -e "${GREEN}✓${NC} $1" >&2; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1" >&2; }
log_error() { echo -e "${RED}✗${NC} $1" >&2; }

if [ "$(getconf LONG_BIT)" == "64" ]; then
    arch=64
  else
    arch=86
fi
uname=$(uname -s)
downloadDir=$(pwd)/download
mkdir -p "$downloadDir"

jqCmd=$(which jq 2>/dev/null || echo "$downloadDir/jq")
if [ ! -f "$jqCmd" ]; then
    if [[ $uname =~ ^Darwin* ]]; then
        if [[ $(arch) == "arm64" ]]; then
        jqName=jq-macos-arm64
        else
        jqName=jq-macos-amd64
        fi
    elif [[ $uname =~ ^Linux* ]]; then
        jqName=jq-linux$arch
    else
        echo "Unknown os: $uname" >&2
        exit
    fi
    jqDl=https://github.com/stedolan/jq/releases/download/jq-1.7.1/$jqName
    echo "Downloading $jqDl to $jqCmd" >&2
    curl -L -o "$jqCmd" $jqDl
    chmod +x "$jqCmd"
fi

log_info "Looking for tiger CLI..."

systemTiger=$(which tiger 2>/dev/null || echo "")
localTiger="$downloadDir/tiger"
tigerCmd=${systemTiger:-${localTiger}}
latestTigerVersion=$(curl -s https://cli.tigerdata.com/latest.txt)
latestTigerVersion=${latestTigerVersion#v}

if [ -f "$systemTiger" ]; then
    # Print the outdated notice (if applicable)
    ${systemTiger} version --check 1>/dev/null
    echo "" >&2
fi

if [ -f "$tigerCmd" ]; then
    tigerVersion=$("${tigerCmd}" version -o bare || echo "N/A")
    if [ -f "${systemTiger}" ]; then
        if [ "${tigerVersion}" != "${latestTigerVersion}" ]; then
            localVersion=$("${localTiger}" version -o bare || echo "N/A")
            if [ "${localVersion}" == "${latestTigerVersion}" ]; then
                log_warning "Detected system installed tiger CLI is outdated, using local copy"
                tigerCmd="${localTiger}"
                tigerVersion=${localVersion}
            else
                log_warning "Detected system installed tiger CLI is outdated, will download a local copy"
            fi
        else
            log_success "Detected system installed tiger CLI (up-to-date)"
        fi
    elif [ "${tigerVersion}" == "${latestTigerVersion}" ]; then
        log_success "Using local copy of tiger CLI (up-to-date)"
    else
        log_info "Using local copy of tiger CLI (will update)"
    fi
else
    tigerVersion="N/A"
    log_info "No tiger CLI detected, will download a local copy"
fi

# If the CLI is outdated or missing, download it locally
if [ "${tigerVersion}" != "${latestTigerVersion}" ]; then
    tigerDl=https://cli.tigerdata.com/releases/v${latestTigerVersion}/tiger-cli_${uname}_$(arch).tar.gz
    echo "Downloading ${tigerDl} to ${localTiger}" >&2
    curl -L -o "${downloadDir}/tiger-cli.tar.gz" "${tigerDl}"
    tar -xzf "${downloadDir}/tiger-cli.tar.gz" -C "${downloadDir}" "tiger"
    rm -f "${downloadDir}/tiger-cli.tar.gz"
    chmod +x "${localTiger}"
    tigerCmd="${localTiger}"
fi
${tigerCmd} version >&2

# Return the directory containing the tiger command (tigerCwd)
echo "${tigerCmd}"