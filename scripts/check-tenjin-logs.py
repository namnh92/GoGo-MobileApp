#!/usr/bin/env python3
"""GoGo-MobileApp#402: does a release APK still call Log.d inside the Tenjin SDK?

The strip in plugins/with-tenjin-android.js fails silently if an AGP or SDK
change stops it matching, and the SDK then prints device identifiers again. The
string "Tenjin::connect params:" stays in the dex either way, so this counts the
calls. Prints a count per Log method; exit 1 when any of v, d, i remains, or when
the APK holds no Tenjin code at all (nothing was checked).

usage: scripts/check-tenjin-logs.py <apk>
"""
import collections
import glob
import os
import re
import subprocess
import sys
import tempfile
import zipfile

CLASS = re.compile(r"\s+Class descriptor\s+:\s+'Lcom/tenjin/android/")
ANY_CLASS = re.compile(r"\s+Class descriptor\s+:")
CALL = re.compile(r"invoke-static.*Landroid/util/Log;\.([a-z]+):")
STRIPPED = {"v", "d", "i"}


def dexdump():
    sdk = os.environ.get("ANDROID_HOME") or os.path.expanduser("~/Library/Android/sdk")
    found = sorted(glob.glob(os.path.join(sdk, "build-tools", "*", "dexdump")))
    if not found:
        sys.exit(f"check-tenjin-logs: no dexdump under {sdk}/build-tools")
    return found[-1]


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    tool = dexdump()
    calls = collections.Counter()
    classes = 0
    with tempfile.TemporaryDirectory() as tmp, zipfile.ZipFile(sys.argv[1]) as apk:
        for name in apk.namelist():
            if not re.fullmatch(r"classes\d*\.dex", name):
                continue
            path = apk.extract(name, tmp)
            dump = subprocess.Popen([tool, "-d", path], stdout=subprocess.PIPE, text=True, errors="replace")
            inside = False
            for line in dump.stdout:
                if ANY_CLASS.match(line):
                    inside = bool(CLASS.match(line))
                    classes += inside
                elif inside and (call := CALL.search(line)):
                    calls[call.group(1)] += 1
            if dump.wait() != 0:
                sys.exit(f"check-tenjin-logs: dexdump failed on {name}")
    print(f"tenjin classes={classes} log calls={dict(sorted(calls.items()))}")
    if classes == 0:
        sys.exit("check-tenjin-logs: no com.tenjin.android class in this APK")
    if STRIPPED & calls.keys():
        sys.exit("check-tenjin-logs: FAIL — the SDK still logs at debug level in this APK")
    print("check-tenjin-logs: PASS")


if __name__ == "__main__":
    main()
