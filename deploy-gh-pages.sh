#!/bin/bash
# 一键把工作台发布到 GitHub Pages
#
# 用法：
#   1. 打开 https://github.com/new 新建一个空仓库（不要勾 README / .gitignore）
#   2. 复制仓库的 SSH 或 HTTPS 地址，例如 git@github.com:zhangsan/my-desk.git
#   3. 在本目录执行：
#        ./deploy-gh-pages.sh git@github.com:zhangsan/my-desk.git
#
# 脚本会重新构建 dist/，然后把它强推到仓库的 gh-pages 分支。
# 首次推送后，到仓库 Settings → Pages → Source 选 gh-pages 分支、根目录 /，
# 等几十秒即可访问 https://zhangsan.github.io/my-desk/

set -e
cd "$(dirname "$0")"

REPO="${1:-}"
if [ -z "$REPO" ]; then
  echo "用法：./deploy-gh-pages.sh <仓库地址>"
  echo "示例：./deploy-gh-pages.sh git@github.com:zhangsan/my-desk.git"
  exit 1
fi

echo "→ 构建 dist/"
node build.js

# 从仓库地址解析出 用户名/仓库名，用于拼出最终访问链接
SLUG=$(echo "$REPO" | sed -E 's#^git@github\.com:##; s#^https://github\.com/##; s#\.git$##')
OWNER=$(dirname "$SLUG")
NAME=$(basename "$SLUG")

echo "→ 推送到 $REPO 的 gh-pages 分支"
cd dist
rm -rf .git
git init -q
git add -A
git -c user.name="WorkBuddy" -c user.email="workbuddy@local" \
    commit -q -m "发布 $(date '+%Y-%m-%d %H:%M')"
git branch -M gh-pages
git remote add origin "$REPO"
git push -f origin gh-pages

echo
echo "✓ 推送完成"
echo
echo "最后一步（只需做一次）："
echo "  打开 https://github.com/$OWNER/$NAME/settings/pages"
echo "  在 Source 里选 gh-pages 分支、根目录 / ，保存"
echo
echo "等几十秒后即可用手机打开："
echo "  https://$OWNER.github.io/$NAME/"
