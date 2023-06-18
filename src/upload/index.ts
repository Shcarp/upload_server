import * as qiniu from "qiniu";
import { config as envConfig } from "dotenv";

envConfig();

export class Qinue {
    static generateUploadToken() {
        const accessKey = process.env.QINIU_ACCESS_KEY;
        const secretKey = process.env.QINIU_SECRET_KEY;
        const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
        const options = {
            scope: process.env.QINIU_BUCKET,
            expires: 7200,
            deadline: Math.round(Date.now() / 1000) + 7200,
        };
        const putPolicy = new qiniu.rs.PutPolicy(options);
        const uploadToken = putPolicy.uploadToken(mac);
        return uploadToken;
    }

    uploadFileStream(key: string, file: NodeJS.ReadableStream) {
        const accessKey = process.env.QINIU_ACCESS_KEY;
        const secretKey = process.env.QINIU_SECRET_KEY;
        const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
        const options = {
            scope: process.env.QINIU_BUCKET,
            expires: 7200,
            deadline: Math.round(Date.now() / 1000) + 7200,
            returnBody:
                '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","mimeType":"$(x:mimeType)"}',
        };
        const putPolicy = new qiniu.rs.PutPolicy(options);
        const uploadToken = putPolicy.uploadToken(mac);

        const config = new qiniu.conf.Config({
            zone: {
                srcUpHosts: ["up-cn-east-2.qiniup.com"],
                cdnUpHosts: ["upload-cn-east-2.qiniup.com"],
                ioHost: "iovip-cn-east-2.qiniuio",
                rsHost: "rs-cn-east-2.qiniuapi.com",
                rsfHost: "rsf-cn-east-2.qiniuapi.com",
                apiHost: "api.qiniuapi.com",
            },
        });

        const formUploader = new qiniu.form_up.FormUploader(config);
        const putExtra = new qiniu.form_up.PutExtra();
        return new Promise(async (resolve, reject) => {
            formUploader.putStream(uploadToken, key, file, putExtra, function (respErr, respBody, respInfo) {
                if (respErr) {
                    reject(respErr);
                }
                if (respInfo.statusCode == 200) {
                    resolve(respBody);
                } else {
                    reject(respBody);
                }
            });
        });
    }

    downloadFile(key: string) {
        const accessKey = process.env.QINIU_ACCESS_KEY;
        const secretKey = process.env.QINIU_SECRET_KEY;
        const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
        const config = new qiniu.conf.Config({
            zone: {
                srcUpHosts: ["up-cn-east-2.qiniup.com"],
                cdnUpHosts: ["upload-cn-east-2.qiniup.com"],
                ioHost: "iovip-cn-east-2.qiniuio",
                rsHost: "rs-cn-east-2.qiniuapi.com",
                rsfHost: "rsf-cn-east-2.qiniuapi.com",
                apiHost: "api.qiniuapi.com",
            },
        });
        const bucketManager = new qiniu.rs.BucketManager(mac, config);
        const deadline = parseInt(`${Date.now() / 1000}`) + 3600; // 1小时过期
        const privateDownloadUrl = bucketManager.privateDownloadUrl(process.env.QINIU_BUCKET_DOMAIN, key, deadline);
        return privateDownloadUrl;
    }

    deleteFile(key: string) {
        const accessKey = process.env.QINIU_ACCESS_KEY;
        const secretKey = process.env.QINIU_SECRET_KEY;
        const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
        const config = new qiniu.conf.Config({
            zone: {
                srcUpHosts: ["up-cn-east-2.qiniup.com"],
                cdnUpHosts: ["upload-cn-east-2.qiniup.com"],
                ioHost: "iovip-cn-east-2.qiniuio",
                rsHost: "rs-cn-east-2.qiniuapi.com",
                rsfHost: "rsf-cn-east-2.qiniuapi.com",
                apiHost: "api.qiniuapi.com",
            },
        });
        const bucketManager = new qiniu.rs.BucketManager(mac, config);
        return new Promise((resolve, reject) => {
            bucketManager.delete(process.env.QINIU_BUCKET, key, function (err, respBody, respInfo) {
                if (err) {
                    reject(err);
                } else {
                    resolve(respBody);
                }
            });
        });
    }
}

export default new Qinue();
