import Koa from "koa";
import Router from "koa-router";
import qinue from "./upload";
import koaBody from "koa-body";
import path from "path";
import fs from "fs";

const app = new Koa();

app.use(
    koaBody({
        // 支持文件格式
        multipart: true,
        // 文件位置
        formidable: {
            uploadDir: path.join(__dirname, "../public"),
            keepExtensions: true,
        },
    })
);

const router = new Router();

// 文件上传
router.post("/upload", async (ctx) => {
    const file = ctx.request.files?.file;
    if (!file) {
        ctx.body = {
            code: 400,
            msg: "文件不能为空",
        };
        return;
    }

    try {
        // 创建可读流
        const reader = fs.createReadStream(file.filepath);
        // 获取文件后缀
        const ext = file.originalFilename.split('.').pop();
        const res: Record<string, any> = await qinue.uploadFileStream(file.newFilename, reader);
        ctx.body = {
            code: 200,
            data: {
                ...res,
                ext
            },
        };
    } catch (error) {
        console.log(error);
        ctx.body = {
            code: 500,
            msg: "上传失败",
        };
    } finally {
        fs.rm(file.filepath, () => {});
    }
});

router.get("/download", async (ctx) => {
    const { key } = ctx.query;
    if (!key) {
        ctx.body = {
            code: 400,
            msg: "文件不能为空",
        };
        return;
    }
    try {
        const res: string = await qinue.downloadFile(key);
        ctx.body = {
            code: 200,
            data: res,
        };
    } catch (error) {
        ctx.body = {
            code: 500,
            msg: "下载失败",
        };
    }
});

router.delete("/delete", async (ctx) => {
    const { key } = ctx.query;
    if (!key) {
        ctx.body = {
            code: 400,
            msg: "文件不能为空",
        };
        return;
    }
    try {
        const res = await qinue.deleteFile(key);
        ctx.body = {
            code: 200,
            data: res,
        };
    } catch (error) {
        ctx.body = {
            code: 500,
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
