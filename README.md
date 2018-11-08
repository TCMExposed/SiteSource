# 揭穿中医！


[TCMExposed](https://TCMExposed.github.io/)

本站主要致力于收集整理各类批判中医的文章资料，包括但不限于对中医理论的批判、对中医药和各种保健品虚假宣传的揭露，除此以外，本站还特别收集陈列一些中医师和中医粉荒诞或搞笑的言论加以点评，以便让人民大众看清这些中医不学无术、固步自封、狂妄自大的真实面目。


欢迎大家踊跃投稿推荐文章！

通过 Github Issues 投稿：<a href="https://github.com/TCMExposed/SiteSource/issues/new?title=投稿：&amp;body=文章链接：%20%0A文章分类：%20" target="_blank">https&#58;//github.com/TCMExposed/SiteSource/</a>


已经收录的文章链接：https://github.com/TCMExposed/SiteSource/blob/master/_utils/answers.txt

网站链接： https://TCMExposed.github.io/



### Build
```
cd _utils;
git diff answers.txt |grep "^+"|grep -v "^+++"|sed 's/^+//' > answers.sync.txt

# Manually check format of answers.sync.txt

node zhihudl.js sync;
cd ..;
git add .;
git commit -m "Update";
git push;


bundle exec jekyll build;
cd _site;
git add .;
git commit -m "Update";
git push;
```
