import * as qiniu from "qiniu";
import { config as envConfig } from "dotenv";

envConfig();

const EXPIRES_TIME = 60 * 60 * 1000;

export class Qinue {
    mac = new qiniu.auth.digest.Mac( process.env.QINIU_ACCESS_KEY, process.env.QINIU_SECRET_KEY);

    options = {
        scope: process.env.QINIU_BUCKET,
        expires: EXPIRES_TIME,
        deadline: Math.round(Date.now() / 1000) + EXPIRES_TIME,
        returnBody:
            '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","mimeType":"$(x:mimeType)"}',
    };

    config = new qiniu.conf.Config({
        zone: {
            srcUpHosts: ["up-cn-east-2.qiniup.com"],
            cdnUpHosts: ["upload-cn-east-2.qiniup.com"],
            ioHost: "iovip-cn-east-2.qiniuio",
            rsHost: "rs-cn-east-2.qiniuapi.com",
            rsfHost: "rsf-cn-east-2.qiniuapi.com",
            apiHost: "api.qiniuapi.com",
        },
    });

    token = null;

    static generateUploadToken() {
        const accessKey = process.env.QINIU_ACCESS_KEY;
        const secretKey = process.env.QINIU_SECRET_KEY;
        const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
        const options = {
            scope: process.env.QINIU_BUCKET,
            expires: EXPIRES_TIME,
            deadline: Math.round(Date.now() / EXPIRES_TIME) + EXPIRES_TIME,
        };
        const putPolicy = new qiniu.rs.PutPolicy(options);
        const uploadToken = putPolicy.uploadToken(mac);
        return uploadToken;
    }

    constructor() {
        // this.generateUploadToken();
    }

    generateUploadToken() {
        const putPolicy = new qiniu.rs.PutPolicy(this.options);
        const uploadToken = putPolicy.uploadToken(this.mac);
        this.token = uploadToken;
        setTimeout(() => {
            this.token = null;
        }, EXPIRES_TIME - 7200)
    }

    uploadFileStream(key: string, file: NodeJS.ReadableStream) {
        if (!this.token) {
            this.generateUploadToken();
        }

        const formUploader = new qiniu.form_up.FormUploader(this.config);
        const putExtra = new qiniu.form_up.PutExtra();
        return new Promise(async (resolve, reject) => {
            formUploader.putStream(this.token, key, file, putExtra, function (respErr, respBody, respInfo) {
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
        const bucketManager = new qiniu.rs.BucketManager(this.mac, this.config);
        const privateDownloadUrl = bucketManager.privateDownloadUrl(process.env.QINIU_BUCKET_DOMAIN, key, EXPIRES_TIME);
        return privateDownloadUrl;
    }

    deleteFile(key: string) {
        const bucketManager = new qiniu.rs.BucketManager(this.mac, this.config);
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
