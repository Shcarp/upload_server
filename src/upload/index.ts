import * as qiniu from "qiniu";
import fs from "fs";
import { config as envConfig } from "dotenv";
import path from "path";

envConfig();

const EXPIRES_TIME = 60 * 60 * 1000;
const SIZE = 1024 * 1024 * 10;

export class Qinue {
    private mac = new qiniu.auth.digest.Mac(process.env.QINIU_ACCESS_KEY, process.env.QINIU_SECRET_KEY);

    private options = {
        scope: process.env.QINIU_BUCKET,
        expires: EXPIRES_TIME,
        deadline: Math.round(Date.now() / 1000) + EXPIRES_TIME,
        returnBody:
            '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)","mimeType":"$(x:mimeType)"}',
    };

    private config = new qiniu.conf.Config({
        zone: {
            srcUpHosts: ["up-cn-east-2.qiniup.com"],
            cdnUpHosts: ["upload-cn-east-2.qiniup.com"],
            ioHost: "iovip-cn-east-2.qiniuio",
            rsHost: "rs-cn-east-2.qiniuapi.com",
            rsfHost: "rsf-cn-east-2.qiniuapi.com",
            apiHost: "api.qiniuapi.com",
        },
    });

    private token = null;

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

    generateUploadToken() {
        const putPolicy = new qiniu.rs.PutPolicy(this.options);
        const uploadToken = putPolicy.uploadToken(this.mac);
        this.token = uploadToken;
        setTimeout(() => {
            this.token = null;
        }, EXPIRES_TIME - 7200)
    }

    uploadFile(key: string, file: string) {
        if (!this.token) {
            this.generateUploadToken();
        }
        const size = fs.statSync(file).size;

        if (size > SIZE) {
            return this.uploadFileSlice(key, file);
        }
        return this.uploadFileStream(key, file);
    }

    private uploadFileStream(key: string, file: string) {
        const reader = fs.createReadStream(file);
        const formUploader = new qiniu.form_up.FormUploader(this.config);
        const putExtra = new qiniu.form_up.PutExtra();
        return new Promise(async (resolve, reject) => {
            formUploader.putStream(this.token, key, reader, putExtra, function (respErr, respBody, respInfo) {
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

    private uploadFileSlice(key: string, file: string) {
        const resumeUploader = new qiniu.resume_up.ResumeUploader(this.config);

        const putExtra = new qiniu.resume_up.PutExtra();

        putExtra.version = "v2";

        putExtra.partSize = SIZE;

        return new Promise(async (resolve, reject) => {
            resumeUploader.putFile(this.token, key, file, putExtra, function (respErr, respBody, respInfo) {
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
        const deadline = parseInt(`${Date.now() / 1000}`) + EXPIRES_TIME; 
        const privateDownloadUrl = bucketManager.privateDownloadUrl(process.env.QINIU_BUCKET_DOMAIN, key, deadline);
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
