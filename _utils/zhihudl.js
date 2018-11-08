// Run node zhihudl.js sync 
// To sync all urls in answers.sync.txt
// Use git diff to generate answers.sync.txt
// $ git diff answers.txt |grep "^+"|grep -v "^+++"|sed 's/^+//' > answers.sync.txt
function noop() {}


var IMG_MAX_WIDTH = 800;
var specialCharsRegex = /[.,@<>\|\[\]\/\\#!$%\^&\*;:{}=\-_`~()"\?']/g
var fs = require('fs');
var https = require('https');
var url = require("url");
var path = require("path");
var SessionCookie = {};
var nodeFetch = require('node-fetch');
var defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:52.0) Gecko/20180601 Firefox/53.0',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,en-US;q=0.7,en;q=0.3',
  'Accept-Encoding': 'gzip',
  'x-udid': 'demo',
  'Connection': 'closed',
  'Referer':'https://www.zhihu.com/'
};
String.prototype.replaceAll = function(a,b) {return this.split(a).join(b)};


var API = {
  members:"https://www.zhihu.com/api/v4/members/", // + username?include=memberProps
  /*
  POST
  method:next
  params:{"url_token":20511618,"pagesize":10,"offset":20}
  */
  answerList:"https://www.zhihu.com/node/QuestionAnswerListV2"
};

main();



function main() {
  var args = process.argv.slice(2);
  var actions = {answer:dlAnswer,post:dlPost,sync:sync};

  if (!actions.hasOwnProperty(args[0])) {
    console.info("Download Zhihu articles.\nActions: "+Object.keys(actions));
    console.info("Examples: ");
    console.info("  node zhihudl.js answer 104484293 spacedCategories spacedTags force");
    console.info("    to download https://www.zhihu.com/question/21476991/answer/104484293");
    console.info("  node zhihudl.js post 26421243");
    console.info("    to download https://zhuanlan.zhihu.com/p/26421243");
    return;
  }
  
  var tpl = readFile("answer.tpl.html");


  var cookies = readFile(__dirname + "/cookies.txt");
  cookies.split("; ").map(a=>{
    var i = a.indexOf('=');
    return [a.slice(0,i),a.slice(i+1)];
  }).forEach((a)=>SessionCookie[a[0]]=a[1]);

  var act = actions[args[0]];
  act.apply(null,args.slice(1));


  function sync(force) {
    var answersListFile = "answers.sync.txt";
    var ans = readFile(answersListFile);
    ans = ans.trim().split(/[\n\r]+/);
    console.log("Before:"+ans.length/2);
    var urlsMap = new Map();
    for (var i=0;i<ans.length;i+=2) {
      var a = ans[i].trim().split(',');
      var cats = a[0],tags = a[1] || '';
      var url = ans[i+1].trim();
      if (urlsMap.has(url)) continue;
      urlsMap.set(url,[cats,tags]);
      console.log("Sync: "+url);
      var aid = url.match(/\d+$/)[0];
      setTimeout((function (aid,cats,tags,force) {
        return function () {dlAnswer(aid,cats,tags,force)};
      })(aid,cats,tags,force),i*1000);
      
    }
    
    var urlValues = Array.from(urlsMap);
    console.log("After:"+urlValues.length);
    
    urlValues = urlValues.sort((a,b) => {
      a = a[1]+""; b = b[1]+"";
      if (a > b) return 1;
      else if (a === b) return 0;
      else return -1;
    });
    
    var content = urlValues.map(kv => {
      var url = kv[0];
      var v = kv[1];
      var cats = v[0].split(/\s+/).sort().join(" ");
      var tags = v[1].split(/\s+/).sort().join(" ");
      return cats+ (tags ? ","+tags : "")+"\n"+url;
    }).join("\n\n");
    
    
    writeFileWith(answersListFile,content);
    
    
  }


  function dlAnswer(aid,cats,tags,force) {

    getAnswer(aid).then(a => {
      if (a.error) {
        console.error(a.error);
        process.exit(1);
      }
      /* {author:{name: '',user_type: 'people',id: '' },
      question:{title: '',id: 21476991,created:2334},
      updated_time: 1501092668,
      content: 'XXX',created_time: 1465144810,updated_time:234,id: 104484293}
      */
      setTimeout(() => { // WTF Node.js Promise swallowed my exception!!! Fuck!!!
        var d = new Date(a.created_time*1000);
        d = d.getFullYear()+"-"+(d.getMonth()+1)+"-" + d.getDate();
        var file = d+"-"+a.question.title.replace(specialCharsRegex,'') + "-" + a.id +".html";
        var postPath = path.normalize(__dirname + "/../_posts/" + file);

        if (!force && fs.existsSync(postPath)) {
          var stat = fs.statSync(postPath);
          var mtime = stat.mtime.getTime();
          if (mtime > a.updated_time * 1000) {
            console.log("Nothing changed: " + file);
            return;
          }
        }

        var content = a.content.replace(/<noscript>.+?<\/noscript>/g,'')
                       .replace(/<figure>|<\/figure>/g,'');

        content = content.replace(/<img\b[^>]+>/g,(img)=>{
          
          var src = img.match(/data-original="([^"]+)"/)
                    || img.match(/data-actualsrc="([^"]+)"/);
                    
          if (!src) return img;

          src = src[1];
          var _m = img.match(/data-rawwidth="([^"]+)"/);
          var width = _m ? Math.min(IMG_MAX_WIDTH,_m[1]) : IMG_MAX_WIDTH;
          var newSrc = "/assets/images/posts/zhihu-img-"+urlFilename(src);
          download(src,__dirname + "/.." + newSrc);
          return "<img class='zhihu-img' width='"+width+"' src='"+newSrc+"' />";
        });

        var description = content.replace(/<[^<>]+>|\s+/g,'').slice(0,200);
        var authorLink = a.author.id == "0" ? "javascript:;"
                        : "https://www.zhihu.com/"+a.author.user_type+"/"+a.author.id;

        
        var post = tpl.replaceAll("{{author.name}}",a.author.name)
              .replaceAll("{{author_link}}",authorLink)
              .replaceAll("{{author.user_type}}",a.author.user_type)
              .replaceAll("{{answer.content}}",content)
              .replaceAll("{{answer.description}}",description.replace(/@/g,''))
              .replaceAll("{{question.title}}",a.question.title + " - by " + a.author.name)
              .replaceAll("{{question.id}}",a.question.id)
              .replaceAll("{{answer.id}}",a.id)
              .replaceAll("{{categories}}",cats || "")
              .replaceAll("{{tags}}",tags || "");

        console.log("Download at: /_posts/" + file);
        writeFileWith(postPath,post);
      },0);


    });
  }

  function dlPost() {
    console.error("Not Implemented Yet!");
  }

}


function writeFileWith(file,s) {
  fs.writeFileSync(file,s,"utf-8");
}


function readFile(file) {
  return fs.readFileSync(file,"utf-8");
}


function download(url,file) {
  // Node.js is fucking stupid! Hell!
  // It will download an incomplete file without any abnormals!
  // https://stackoverflow.com/questions/47812126/node-get-request-response-incomplete

  var request = https.get(url, {
    encoding: 'binary',
    headers: {
      "Referer":"https://www.zhihu.com/",
      "Connection": "keep-alive"
    }
  }, function(res) {
    //response.pipe(file);
    var chunks = [];
    res.on('data',(a)=>{
      if (!a) return;
      chunks.push(a);
    }).on('end',()=>{
      var b = Buffer.concat(chunks);
      fs.writeFileSync(file,b);
    });
  });
  request.setTimeout(600000);

  request.on('error', (err) => {
    console.log("Fucking Node.js Download Error!\n"+url);
    console.error(err);
    fs.unlink(file);
    setTimeout(()=>download(url,file),1000);
  });
}

function urlFilename(u) {
  var parsed = url.parse(u);
  return path.basename(parsed.pathname);
}


function reportError(err) {
  console.error(err);
}

function serializeCookie() {
  var a=[];
  for (var k in SessionCookie) {
    a.push(k+'='+SessionCookie[k]);
  }
  return a.join('; ');
}



function req(url,opt) {
  opt = opt || {};
  opt.headers = opt.headers || {};

  for (var k in defaultHeaders) {
    opt.headers[k] = opt.headers[k] || defaultHeaders[k];
  }

  opt.headers.Authorization = "Bearer " + SessionCookie['z_c0'];
  opt.headers["x-udid"] = (SessionCookie['d_c0'] || "").slice(1,-1).split("|")[0];
  if (opt.method && opt.method!='GET') {
    opt.headers['X-Xsrftoken'] =  SessionCookie['_xsrf'];
  }

  opt.headers.Cookie = serializeCookie();
  opt.credentials = 'include';

  return delay(1).then(()=>nodeFetch(url,opt).then(wrapResponse));

  function wrapResponse(resp) {
    var json = resp.json;
    //console.log("Fecth: "+ url)
    resp.json = ()=>{
      var ct = resp.headers.get("content-type") || "";
      if(ct.indexOf("application/json")>-1) {
        /*return resp.text().then(t=>{
          console.log(t);
          return JSON.parse(t);
        },logRespError);*/
        return json.call(resp).catch(err=>{
            logRespError(err);
            return Promise.reject(err);
        });
      } else {
        var err = "Expect JSON, got:"+ct;
        logRespError(err);
        return Promise.reject(err);
        /*
        if (resp.status == 404) {
          return Promise.reject(err);
        } else {
          //console.log(resp.status,ct);
          return delay(1).then(()=>req(url,opt).then(r=>r.json()));
        }*/

      }
    };
    return resp;

    function logRespError(e) {
      console.error("JSON Response Error!");
      console.error(e);
      console.error("URL:"+url);

      resp.text().then(t => {
        console.error(t.replace(/<[^<>]+>| \t/g,'').replace(/\s+/g," ").trim())
      });
    }
  }
}



function delay(seconds) {
  return new Promise((resolve,reject)=>{
    setTimeout(resolve,seconds*1000);
  });
}

function params(p) {
  var a=[];
  for (var k in p) {
    a.push(k+'='+escapeURI(p[k]));
  }
  return a.join('&');
}

function getAnswer(id) {
  return req("https://www.zhihu.com/api/v4/answers/" + id + "?include=content" ).then(r=>r.json());

}



function getXSRFToken() {
  return SessionCookie._xsrf;
}



function a2map(a) {
  var map = {};
  a.forEach(x => map[x]=1);
  return map;
}

function unique(a) {
  var b = [];
  a.sort();
  for(var i=0,l=a.length;i<l;i++) {
    if (!a[i] || a[i]===b[0]) continue;
    b.unshift(a[i]);
  }
  return b;
}



function checkType(a,t) {
  for (var k in t) {
    var v = a[k];
    if (v==undefined || v.constructor !== t[k]) {
      console.error("Expect "+k+" is type " + t[k].name+"\nGot:"+(v && v.constructor.name));
      process.exit(1);
      throw "Type Error";
    }
  }
}








