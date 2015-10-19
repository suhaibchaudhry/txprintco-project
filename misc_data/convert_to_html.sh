#!/usr/bin/env bash
cat states_list.txt | sed 's/|/\t/' | awk '{print "<option value=\""$1"\">"$2"</option>"}'
