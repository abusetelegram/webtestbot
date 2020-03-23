const WebPageTest = require('webpagetest');
const wpt = new WebPageTest('www.webpagetest.org',process.env.WEBPAGE_TOKEN);
const got = require('got')
const Telegraf = require('telegraf')

const bot = new Telegraf(process.env.BOT_TOKEN)

function poll(fn, timeout, interval) {
    let endTime = Number(new Date()) + (timeout || 180000);
    interval = interval || 10000;

    var checkCondition = function(resolve, reject) { 
        var ajax = fn();
        // dive into the ajax promise
        ajax.then( function(response){
            // If the condition is met, we're done!
            if(response.data.statusCode == 200) {
                resolve(response.data);
            }
            // If the condition isn't met but the timeout hasn't elapsed, go again
            else if (Number(new Date()) < endTime) {
                setTimeout(checkCondition, interval, resolve, reject);
            }
            // Didn't match and too much time, reject!
            else {
                reject(new Error('timed out for ' + fn + ': ' + arguments));
            }
        });
    };

    return new Promise(checkCondition);
}

function ask(ctx, jsonUrl, testId) {
    poll(() => {
        return got(jsonUrl).json()
    }).then(data => {
        let photoGroup = []
        for (let [key, value] of Object.entries(data.runs[0].images)) {
            photoGroup.push({
                type: 'photo',
                media: value,
                caption: `${testId}'s ${key}`
            })
        }
        ctx.replyWithMediaGroup(photoGroup)
    }).catch((err) => {
        console.log(err)
        ctx.reply("更新数据时发生错误，停止")
    })
}

function query(url, ctx) {
    wpt.runTest(url, {
        logData: 0,
        private: true,
        firstViewOnly: true
        },(err, data) => {
            if (err) {
                console.log(err)
                ctx.reply("请求未完成：" + err.toString())
                return 
            }
            
            const { jsonUrl, testId, userUrl } = data.data

            ctx.replyWithMarkdown(`成功为\`${url}\`生成[测试](${userUrl} )\`${testId}\`！\n截图将在报告完成后更新`)

            ask(ctx, jsonUrl, testId)
        })
}

bot.start((ctx) => ctx.reply('直接输入文字获取Webpagetest结果'))
bot.on('text', (ctx) => {
    console.log(ctx.chat)
    let url = null
    if (ctx.message.entities) {
        if (ctx.message.entities[0].type == 'url') {
            url = ctx.message.text.substring(ctx.message.entities[0].offset, ctx.message.entities[0].length)
        }
    }

    if (url) {
        console.log(url)
        query(url, ctx)
    } else {
        console.log("Failed: ", ctx.message)
        ctx.reply("找不到合法的url")
    }
})


exports.handler = (event, context, callback) => {
    const tmp = JSON.parse(event.body); // get data passed to us
    bot.handleUpdate(tmp); // make Telegraf process that data
    return callback(null, { // return something for webhook, so it doesn't try to send same stuff again
      statusCode: 200,
      body: '',
    });
  };