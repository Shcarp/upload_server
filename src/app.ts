import Koa from "koa";
import Router from "koa-router";
import qinue from "./upload";
import koaBody from "koa-body";
import path from "path";
import fs from "fs";
import request from "request";

const app = new Koa();

const POS = path.join(__dirname, "../cache")

app.use(
    koaBody({
        // 支持文件格式
        multipart: true,
        // 文件位置
        formidable: {
            uploadDir: POS,
            keepExtensions: true,
        },
    })
);

const router = new Router();

let timer = null;

const handleDownload = (key: string) => {
    return new Promise(async (resolve, reject) => {
        // 判断cache文件夹下是否有该文件, 如果有读取该文件，返回流
        const filePath = path.join(POS, key);
        if (fs.existsSync(filePath)) {
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    reject(err)
                }
                resolve(data)
            });
        } else {
            // 如果没有该文件，从七牛云下载
            try {
                const link: string = await qinue.downloadFile(key);
                request(link, {
                    headers: {
                        "Content-Type": "arraybuffer",
                    },
                }, (err, response) => {
                    if (err) {
                        reject(err)
                    }
                    resolve(response.body)
                });
            } catch (error) {
                reject(error)
            }
        }
    });
};

// 文件上传
router.post("/upload", async (ctx) => {
    const file = ctx.request.files?.file;
    if (!file) {
        ctx.status = 400;
        ctx.body = {
            code: 1,
            msg: "文件不能为空",
        };
        return;
    }

    if (file.size > 20 * 1024 * 1024) {
        ctx.status = 400;
        ctx.body = {
            code: 1,
            msg: "文件不能大于20M",
        };
        return;
    }

    // 获取文件后缀
    const ext = file.originalFilename.split(".").pop();
    // 获取文件名
    const key = file.newFilename;

    // 在一定时间后上传cache文件夹下的文件
    clearTimeout(timer);
    timer = setTimeout(() => {
        // 获取cache文件夹下的文件\
        fs.readdir(POS, (err, files) => {
            if (err) {
                console.log(err);
                return;
            }
            files.forEach(async (item) => {
                try {
                    const filePath = path.join(POS, item);
                    // 上传文件到七牛云
                    await qinue.uploadFile(item, filePath);
                    // 删除cache文件夹下的文件
                    fs.rm(filePath, () => {});
                } catch (error) {
                    console.log(error);
                }
            });
        });
    }, 6000);

    ctx.body = {
        code: 0,
        data: {
            key,
            ext,
        },
    };
});

router.get("/download", async (ctx) => {
    const { key } = ctx.query;
    if (!key) {
        ctx.status = 400;
        ctx.body = {
            code: 1,
            msg: "文件不能为空",
        };
        return;
    }
    try {
        const data = await handleDownload(key)
        ctx.body = data
    } catch (error) {
        ctx.status = 500;
        ctx.body = {
            code: 1,
            msg: "下载失败",
        };
    }
});

router.delete("/delete", async (ctx) => {
    const { key } = ctx.query;
    if (!key) {
        ctx.status = 400;
        ctx.body = {
            code: 1,
            msg: "文件不能为空",
        };
        return;
    }
    try {
        const res = await qinue.deleteFile(key);
        ctx.body = res
    } catch (error) {
        ctx.status = 500;
        ctx.body = {
            code: 1,
            msg: "删除失败",
        };
    }
});

app.use(router.routes()).use(router.allowedMethods());

app.listen(
    {
        host: "0.0.0.0",
        port: 8090,
    },
    () => {
        console.log("server is running at http://0.0.0.0:8090");
    }
);
