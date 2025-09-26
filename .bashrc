#!/bin/bash
# Copyright 2025 Product Decoder
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# shellcheck shell=bash
# -*- shell -*-
# ~/.bashrc: executed by bash(1) for non-login shells.
# see /usr/share/doc/bash/examples/startup-files (in the package bash-doc)
# for examples

# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac

# ===== HISTORY CONFIGURATION =====
# Don't put duplicate lines or lines starting with space in the history
HISTCONTROL=ignoreboth:erasedups

# Append to the history file, don't overwrite it
shopt -s histappend

# For setting history length see HISTSIZE and HISTFILESIZE in bash(1)
HISTSIZE=10000
HISTFILESIZE=20000

# Save and reload the history after each command finishes
export PROMPT_COMMAND="history -a; history -c; history -r; $PROMPT_COMMAND"

# Add timestamp to history entries
export HISTTIMEFORMAT="%F %T "

# ===== SHELL OPTIONS =====
# Check the window size after each command and update LINES and COLUMNS
shopt -s checkwinsize

# Autocorrect typos in path names when using `cd`
shopt -s cdspell

# Enable recursive globbing with **
shopt -s globstar

# Bash won't get SIGWINCH if another process is in the foreground.
shopt -s checkjobs

# Enable programmable completion
if ! shopt -oq posix; then
  if [ -f /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  elif [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
  fi
fi

# ===== APPEARANCE =====
# make less more friendly for non-text input files
[ -x /usr/bin/lesspipe ] && eval "$(SHELL=/bin/sh lesspipe)"

# Set variable identifying chroot
if [ -z "${debian_chroot:-}" ] && [ -r /etc/debian_chroot ]; then
    debian_chroot=$(cat /etc/debian_chroot)
fi

# Set a fancy prompt (non-color, unless we know we "want" color)
case "$TERM" in
    xterm-color|*-256color) color_prompt=yes;;
esac

# Force color prompt
force_color_prompt=yes

if [ -n "$force_color_prompt" ]; then
    if [ -x /usr/bin/tput ] && tput setaf 1 >&/dev/null; then
        color_prompt=yes
    else
        color_prompt=
    fi
fi

# Function to determine if git prompt is available
__git_prompt_available() {
    type -t __git_ps1 &>/dev/null
}

# Set the prompt
if [ "$color_prompt" = yes ]; then
    # Define colors
    RESET="\[\033[0m\]"
    GREEN="\[\033[01;32m\]"
    BLUE="\[\033[01;34m\]"
    YELLOW="\[\033[0;33m\]"
    RED="\[\033[0;31m\]"

    # Set base prompt
    PS1="${debian_chroot:+($debian_chroot)}${GREEN}\u@\h${RESET}:${BLUE}\w${RESET}"

    # Add git status if available
    if __git_prompt_available; then
        PS1+="${YELLOW}\$(__git_ps1)${RESET}"
    fi

    # Add $ at the end
    PS1+="\$ "
else
    PS1='${debian_chroot:+($debian_chroot)}\u@\h:\w\$ '
fi
unset color_prompt force_color_prompt

# If this is an xterm set the title to user@host:dir
case "$TERM" in
xterm*|rxvt*)
    PS1="\[\e]0;${debian_chroot:+($debian_chroot)}\u@\h: \w\a\]$PS1"
    ;;
*)
    ;;
esac

# ===== ALIASES =====
# Enable color support for common commands
if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    alias ls='ls --color=auto'
    alias dir='dir --color=auto'
    alias vdir='vdir --color=auto'
    alias grep='grep --color=auto'
    alias fgrep='fgrep --color=auto'
    alias egrep='egrep --color=auto'
    alias diff='diff --color=auto'
fi

# Colored GCC warnings and errors
export GCC_COLORS='error=01;31:warning=01;35:note=01;36:caret=01;32:locus=01:quote=01'

# ls aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias lt='ls -lrth'  # Sort by time, human readable

# project scripts
alias killports='./bin/killports'
alias docker='./bin/docker'

# Directory navigation
alias ..='cd ..'
alias ...='cd ../..'
alias ....='cd ../../..'
alias .....='cd ../../../..'
alias -- -='cd -'  # Go back to previous directory

# Common aliases
alias c='clear'
alias h='history'
alias j='jobs -l'
alias sudo='sudo '  # Allow aliases to be sudo'ed
alias mkdir='mkdir -pv'  # Create parent dirs as needed
alias wget='wget -c'  # Resume downloads by default
alias df='df -h'  # Human readable by default
alias du='du -h'  # Human readable by default
alias free='free -h'  # Human readable by default
alias cp='cp -i'  # Interactive (ask before overwrite)
alias mv='mv -i'  # Interactive (ask before overwrite)
alias rm='rm -I'  # Less intrusive interactive
alias clip='xclip -selection clipboard'
alias sb='source ~/.bashrc'
alias nb='nano ~/.bashrc'

# Add an "alert" alias for long running commands
alias alert='notify-send --urgency=low -i "$([ $? = 0 ] && echo terminal || echo error)" "$(history|tail -n1|sed -e '\''s/^\s*[0-9]\+\s*//;s/[;&|]\s*alert$//'\'')"'

# ===== FUNCTIONS =====
# Extended tree
tree() {
  local depth="${1:-2}"
  if [[ "$2" == "--gitignore" ]]; then
    command tree -L "$depth" --gitignore
  else
    local ignore="${2:-}"
    if [[ -n "$ignore" ]]; then
      command tree -L "$depth" -I "$ignore"
    else
      command tree -L "$depth"
    fi
  fi
}

# Creat files w/ exts.
fxt() {
    local ext="$1"
    shift
    local arr=("$@")

    for i in "${arr[@]}"; do
        touch "$i$ext"
    done
}

# Create directory and cd into it
mkcd() {
  mkdir -p "$1" && cd "$1" || return
}

# Extract most known archives
extract() {
  if [ -f "$1" ] ; then
    case $1 in
      *.tar.bz2)   tar xjf "$1"       ;;
      *.tar.gz)    tar xzf "$1"       ;;
      *.tar.xz)    tar xJf "$1"       ;;
      *.bz2)       bunzip2 "$1"       ;;
      *.rar)       unrar e "$1"       ;;
      *.gz)        gunzip "$1"        ;;
      *.tar)       tar xf "$1"        ;;
      *.tbz2)      tar xjf "$1"       ;;
      *.tgz)       tar xzf "$1"       ;;
      *.zip)       unzip "$1"         ;;
      *.Z)         uncompress "$1"    ;;
      *.7z)        7z x "$1"          ;;
      *)           echo "'$1' cannot be extracted via extract()" ;;
    esac
  else
    echo "'$1' is not a valid file"
  fi
}

# Enhanced cd - show directory content after cd
cd() {
  builtin cd "$@" || return
  ls -F
}

# Find string in files
fif() {
  grep -r "$1" .
}

# Advanced search and replace
sr() {
  if [ $# -ne 2 ]; then
    echo "Usage: sr search_string replace_string"
    return 1
  fi
  find . -type f -not -path "*/node_modules/*" -not -path "*/\.git/*" -exec grep -l "$1" {} \; | xargs sed -i "s/$1/$2/g"
}

# ===== PATH CONFIGURATION =====
# User local bin directory
export PATH="$HOME/.local/bin:$PATH"

# Ruby setup
export GEM_HOME="$HOME/gems"
export PATH="$HOME/gems/bin:$PATH"

# Python setup
alias python='python3'

# Dart
export PATH="$PATH":"$HOME/.pub-cache/bin"

# Composer
export PATH="$PATH:$HOME/.config/composer/vendor/bin"

# Homebrew
if [ -f "/home/linuxbrew/.linuxbrew/bin/brew" ]; then
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi

# Bun
if [ command -v bun ]; then
  export PATH="$PATH:$HOME/.bun/bin"
else
  curl -fsSL https://bun.sh/install | bash
  export PATH="$PATH:$HOME/.bun/bin"
fi

# ===== CUSTOM BASH ALIASES =====
# Source custom aliases if file exists
if [ -f ~/.bash_aliases ]; then
    . ~/.bash_aliases
fi
