/**
 * Patched Crypt.js for guacamole-lite
 *
 * The original Crypt.js uses 'binary' (latin1) and 'ascii' string encodings
 * for cipher operations, which corrupt bytes > 127. This patched version
 * uses pure Buffer operations, matching Server.js's decryptToken() method.
 *
 * This file replaces node_modules/guacamole-lite/lib/Crypt.js at build time
 * via a COPY in the Dockerfile.
 */
const Crypto = require('crypto');

class Crypt {

    constructor(cypher, key) {
        this.cypher = cypher;
        this.key = key;
    }

    decrypt(encodedString) {
        const tokenData = JSON.parse(Buffer.from(encodedString, 'base64').toString('utf8'));
        const iv = Buffer.from(tokenData.iv, 'base64');
        const value = Buffer.from(tokenData.value, 'base64');

        const decipher = Crypto.createDecipheriv(this.cypher, this.key, iv);

        let decrypted = decipher.update(value, null, 'utf8');
        decrypted += decipher.final('utf8');

        return JSON.parse(decrypted);
    }

    encrypt(jsonData) {
        const iv = Crypto.randomBytes(16);
        const cipher = Crypto.createCipheriv(this.cypher, this.key, iv);

        const encrypted = Buffer.concat([
            cipher.update(JSON.stringify(jsonData), 'utf8'),
            cipher.final()
        ]);

        const data = {
            iv: iv.toString('base64'),
            value: encrypted.toString('base64')
        };

        return Buffer.from(JSON.stringify(data)).toString('base64');
    }

    static base64decode(string, mode) {
        return Buffer.from(string, 'base64').toString(mode || 'utf8');
    }

    static base64encode(string, mode) {
        return Buffer.from(string, mode || 'utf8').toString('base64');
    }

}

module.exports = Crypt;
