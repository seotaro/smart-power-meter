'use strict';

const moment = require("moment");
const utils = require('./utils');

// Echonet オブジェクト = EOJ
class EchonetObject {
    static PRESET = {
        // 管理・操作関連機器クラスグループ x コントローラー（Wi-SUN デバイス = 自分自身） x インスタンスコード
        'コントローラー': new EchonetObject(0x05, 0xFF, 0x01),

        // 住宅・設備関連機器クラスグループ x 低圧スマート電力量メータ x インスタンスコード
        // インスタンスコードは 0x01 から採番されていくが、普通のご家庭には電力量メータは1つのはずなので決め打ちにする。
        // 丁寧にやるならインスタンスリスト通知でインスタンスコードを決める。
        'スマート電力量メータ': new EchonetObject(0x02, 0x88, 0x01),

        // プロファイルクラスグループ x ノードプロファイル x 一般ノード
        'ノードプロファイル': new EchonetObject(0x0E, 0xF0, 0x01),
    }

    constructor(classGroupCode, classCode, instanceCode) {
        this._classGroupCode = classGroupCode;
        this._classCode = classCode;
        this._instanceCode = instanceCode;
    }

    set classGroupCode(code) { this._classGroupCode = code; }
    set classCode(code) { this._classCode = code; }
    set instanceCode(code) { this._instanceCode = code; }

    get classGroupCode() { return this._classGroupCode; }
    get classCode() { return this._classCode; }
    get instanceCode() { return this._instanceCode; }

    static equals(a, b) {
        if (a.classGroupCode !== b.classGroupCode) {
            return false;
        }

        if (a.classCode !== b.classCode) {
            return false;
        }

        if (a.instanceCode !== b.instanceCode) {
            return false;
        }

        return true;
    }

    toString() {
        let classGroupCodeName = `0x${utils.toHex(this._classGroupCode, 2)}`;
        let classCodeName = `0x${utils.toHex(this._classCode, 2)}`;
        let instanceCodeName = `0x${utils.toHex(this._instanceCode, 2)}`;

        switch (this._classGroupCode) {
            case 0x00:
                classGroupCodeName = 'センサ関連機器クラスグループ';
                break;

            case 0x01:
                classGroupCodeName = '空調関連機器クラスグループ';
                break;

            case 0x02:
                classGroupCodeName = '住宅・設備関連機器クラスグループ';
                switch (this._classCode) {
                    case 0x88:
                        classCodeName = '低圧スマート電力量メータ'
                        switch (this._instanceCode) {
                            case 0x00: instanceCodeName += '（全インスタンス指定コード）'; break;
                        }
                        break;
                }
                break;

            case 0x03:
                classGroupCodeName = '調理・火事関連機器クラスグループ';
                break;

            case 0x04:
                classGroupCodeName = '健康関連機器クラスグループ';
                break;

            case 0x05:
                classGroupCodeName = '管理・操作関連機器クラスグループ';
                switch (this._classCode) {
                    case 0xff:
                        classCodeName = 'コントローラ'
                        break;
                }
                break;

            case 0x06:
                classGroupCodeName = 'AV関連機器クラスグループ';
                break;

            case 0x0E:
                classGroupCodeName = 'プロファイルクラスグループ';
                switch (this._classCode) {
                    case 0xf0:
                        classCodeName = 'ノードプロファイル'
                        switch (this._instanceCode) {
                            case 0x01: instanceCodeName += '（一般ノード）'; break;
                            case 0x02: instanceCodeName += '（送信専用ノード）'; break;
                        }
                        break;

                    default:
                        classCodeName = 'For future reserved'
                        break;
                }
                break;

            case 0x0F:
                classGroupCodeName = 'ユーザ定義クラスグループ';
                break;

            default:
                classGroupCodeName = 'For future reserved';
                break;
        }

        return `${classGroupCodeName} / ${classCodeName} / ${instanceCodeName}`;
    }
}

// Echonet のフレームを定義する
class Frame {
    // フレームのプリセット
    static PRESET = {
        '瞬時電力計測値': Frame.create(
            EchonetObject.PRESET['コントローラー'],
            EchonetObject.PRESET['スマート電力量メータ'],
            0x62,   // プロパティ値読み出し要求
            [{ EPC: 0xE7, PDC: 0x00, EDT: null }]
        ),
        '定時積算電力量計測値（正方向計測値）': Frame.create(
            EchonetObject.PRESET['コントローラー'],
            EchonetObject.PRESET['スマート電力量メータ'],
            0x62,   // プロパティ値読み出し要求
            [{ EPC: 0xEA, PDC: 0x00, EDT: null }]
        ),

        '定時積算電力量計測値（逆方向計測値）': Frame.create(
            EchonetObject.PRESET['コントローラー'],
            EchonetObject.PRESET['スマート電力量メータ'],
            0x62,   // プロパティ値読み出し要求
            [{ EPC: 0xEB, PDC: 0x00, EDT: null }]
        ),
    }

    constructor() {
        this._EHD1 = 0x10;          // 0x10 = ECHONET Lite 規格
        this._EHD2 = 0x81;          // 0x81 = 形式1
        this._TID = [0x00, 0x00];   // トランザクション ID は使用しないので固定値

        // EDATA
        this._SEOJ = new EchonetObject(0x00, 0x00, 0x00);   // 送信元 ECHONET Lite オブジェクト
        this._DEOJ = new EchonetObject(0x00, 0x00, 0x00);   // 送信先 ECHONET Lite オブジェクト
        this._ESV = 0x00;                                   // ECHONET Lite サービス
        this._OPC = 0x00;                                   // 処理プロパティ数、後に続く properties（ EPC・PDC・EDT の組）の個数
        this._properties = [];
    }

    set SEOJ(EOJ) { this._SEOJ = EOJ; }
    set DEOJ(EOJ) { this._DEOJ = EOJ; }
    set ESV(ESV) { this._ESV = ESV; }
    set properties(properties) {
        this._properties = properties;
        this._OPC = this._properties.length;
    }

    get SEOJ() { return this._SEOJ; }
    get DEOJ() { return this._DEOJ; }
    get ESV() { return this._ESV; }
    get OPC() { return this._OPC; }
    get properties() { return this._properties; }

    addProperty(EPC, PDC, EDT) {
        this._properties.push({ EPC: EPC, PDC: PDC, EDT: EDT });
        this._OPC = this._properties.length;
    }

    getProperty(index) {
        return this._properties[index];
    }

    toBuffer() {
        let length = 1 + 1 + 2 + 3 + 3 + 1 + 1;
        this._properties.forEach(property => {
            length += 2;
            length += property.PDC;
        });

        let buffer = Buffer.alloc(length);

        let i = 0;
        buffer[i++] = this._EHD1;
        buffer[i++] = this._EHD2;
        buffer[i++] = this._TID[0];
        buffer[i++] = this._TID[1];
        buffer[i++] = this._SEOJ.classGroupCode;
        buffer[i++] = this._SEOJ.classCode;
        buffer[i++] = this._SEOJ.instanceCode;
        buffer[i++] = this._DEOJ.classGroupCode;
        buffer[i++] = this._DEOJ.classCode;
        buffer[i++] = this._DEOJ.instanceCode;
        buffer[i++] = this._ESV;
        buffer[i++] = this._OPC;

        for (let j = 0; j < this._OPC; j++) {
            const property = this._properties[j];
            buffer[i++] = property.EPC;
            buffer[i++] = property.PDC;

            for (let k = 0; k < property.PDC; k++) {
                buffer[i++] = property.EDT[k];
            }
        }

        return buffer;
    }

    toString() {
        let str = '';
        str += `送信元オブジェクト: ${this._SEOJ.toString()}\n`;
        str += `送信先オブジェクト: ${this._DEOJ.toString()}\n`;
        str += `サービス: ${esvToString(this._ESV)}\n`;

        for (let i = 0; i < this._properties.length; i++) {
            const property = this._properties[i];
            str += `プロパティ（${i}）: ${JSON.stringify(Frame.parseProperty(this._SEOJ, property))}`;
        }

        return str;
    }

    static from(buffer) {
        const frame = new Frame();

        let i = 0;

        frame.EHD1 = buffer[i++];
        frame.EHD2 = buffer[i++];
        frame.TID = [buffer[i++], buffer[i++]];
        frame.SEOJ = new EchonetObject(buffer[i++], buffer[i++], buffer[i++]);
        frame.DEOJ = new EchonetObject(buffer[i++], buffer[i++], buffer[i++]);
        frame.ESV = buffer[i++];
        const OPC = buffer[i++];

        for (let j = 0; j < OPC; j++) {
            const EPC = buffer[i++];
            const PDC = buffer[i++];

            const EDT = buffer.slice(i, i + PDC);
            i += PDC;

            frame.addProperty(EPC, PDC, EDT);
        }

        if (frame.OPC !== frame.properties.length) {
            console.error(`OPC(${frame.OPC}) != プロパティ数(${frame.properties.length})`);
        }

        return frame;
    }

    static create(SEOJ, DEOJ, ESV, properties) {
        const frame = new Frame();
        frame.SEOJ = SEOJ;
        frame.DEOJ = DEOJ;
        frame.ESV = ESV;
        frame.properties = properties;
        // frame.forEach(property => {
        //     frame.addProperty(property);
        // });
        return frame;
    }

    static parseProperty(EOJ, property) {
        let ret = null;

        switch (EOJ.classGroupCode) {
            case 0x02:  // 住宅・設備関連機器クラスグループ
                switch (EOJ.classCode) {
                    case 0x88:  // 低圧スマート電力量メータ
                        switch (property.EPC) {
                            // case 0x80: name = '動作状態'; break;
                            // case 0xD3: name = '係数'; break;
                            // case 0xD7: name = '積算電力量有効桁数'; break;
                            // case 0xE0: name = '積算電力量計測値（正方向計測値）'; break;
                            // case 0xE1: name = '積算電力量単位（正方向、逆方向計測値）'; break;
                            // case 0xE2: name = '積算電力量計測値履歴1（正方向計測値）'; break;
                            // case 0xE3: name = '積算電力量計測値（逆方向計測値）'; break;
                            // case 0xE4: name = '積算電力量計測値履歴1（逆方向計測値）'; break;
                            // case 0xE5: name = '積算履歴収集日1'; break;
                            case 0xE7:
                                {
                                    const buf = Uint8Array.from(property.EDT).buffer;
                                    ret = {
                                        type: '瞬時電力計測値',
                                        value: new DataView(buf).getInt32(0),
                                        unit: 'W'
                                    }
                                }
                                break;

                            // case 0xE8: name = '瞬時電流計測値'; break;

                            case 0xEA:
                                {
                                    const buf = Uint8Array.from(property.EDT).buffer;

                                    const year = new DataView(buf, 0, 2).getUint16(0);
                                    const month = new DataView(buf, 2, 1).getUint8(0);
                                    const day = new DataView(buf, 3, 1).getUint8(0);
                                    const hours = new DataView(buf, 4, 1).getUint8(0);
                                    const minutes = new DataView(buf, 5, 1).getUint8(0);
                                    const seconds = new DataView(buf, 6, 1).getUint8(0);
                                    const datetime = moment(`${year}-${month}-${day} ${hours}:${minutes}:${seconds} +0900`, `YYYY-MM-DD HH:mm:ss Z`);

                                    ret = {
                                        type: '定時積算電力量計測値（正方向計測値）',
                                        datetime: datetime,
                                        value: new DataView(buf, 7, 4).getUint32(0),
                                        unit: 'kWh'
                                    }
                                }
                                break;

                            case 0xEB:
                                {
                                    const buf = Uint8Array.from(property.EDT).buffer;

                                    const year = new DataView(buf, 0, 2).getUint16(0);
                                    const month = new DataView(buf, 2, 1).getUint8(0);
                                    const day = new DataView(buf, 3, 1).getUint8(0);
                                    const hours = new DataView(buf, 4, 1).getUint8(0);
                                    const minutes = new DataView(buf, 5, 1).getUint8(0);
                                    const seconds = new DataView(buf, 6, 1).getUint8(0);
                                    const datetime = moment(`${year}-${month}-${day} ${hours}:${minutes}:${seconds} +0900`, `YYYY-MM-DD HH:mm:ss Z`);

                                    ret = {
                                        type: '定時積算電力量計測値（逆方向計測値）',
                                        datetime: datetime,
                                        value: new DataView(buf, 7, 4).getUint32(0),
                                        unit: 'kWh'
                                    }
                                }
                                break;

                            // case 0xEC: name = '積算電力量計測値履歴2（正方向、逆方向計測値）'; break;
                            // case 0xED: name = '積算履歴収集日2'; break;

                            default:
                                throw new Error(`invalid EPC = ${property.EPC}`);
                                break;
                        }
                        break;
                }
                break;

            case 0x05:  // 管理・操作関連機器クラスグループ
                switch (EOJ.classCode) {
                    case 0xff:  // コントローラ
                        break;
                }
                break;

            case 0x0E:  // プロファイルクラスグループ
                switch (EOJ.classCode) {
                    case 0xf0:  // ノードプロファイル
                        switch (EOJ.instanceCode) {
                            case 0x01: // 一般ノード
                            case 0x02: // 送信専用ノード
                                switch (property.EPC) {
                                    // case 0x80: name = '動作状態'; break;
                                    // case 0x82: name = 'Version 情報'; break;
                                    // case 0x83: name = '識別番号'; break;
                                    // case 0x89: name = '異常内容'; break;
                                    // case 0x8F: name = '個体識別情報'; break;
                                    // case 0xD3: name = '自ノードインスタンス数'; break;
                                    // case 0xD4: name = '自ノードクラス数'; break;

                                    case 0xD5:
                                        {
                                            let instances = [];
                                            for (let i = 0; i < property.EDT[0]; i++) {
                                                instances.push(new EchonetObject(property.EDT[i * 3 + 1], property.EDT[i * 3 + 2], property.EDT[i * 3 + 3]));
                                            }
                                            ret = {
                                                type: 'インスタンスリスト通知',
                                                value: instances,
                                            }
                                        }
                                        break;

                                    // case 0xD6: name = '自ノードインスタンスリストS'; break;
                                    // case 0xD7: name = '自ノードクラスリストS'; break;

                                    default:
                                        throw new Error(`invalid EPC = ${property.EPC}`);
                                        break;
                                }
                                break;
                        }
                        break;
                }
                break;

            case 0x00:  // センサ関連機器クラスグループ
            case 0x01:  // 空調関連機器クラスグループ
            case 0x03:  // 調理・火事関連機器クラスグループ
            case 0x04:  // 健康関連機器クラスグループ
            case 0x06:  // AV関連機器クラスグループ
            case 0x0F:  // ユーザ定義クラスグループ
                break;
        }

        return ret;
    }
}




const esvToString = (ESV) => {
    let name = 'invalid ESV';
    switch (ESV) {
        case 0x60: name = 'プロパティ値書き込み要求（応答不要）'; break;
        case 0x61: name = 'プロパティ値書き込み要求（応答要）'; break;
        case 0x62: name = 'プロパティ値読み出し要求'; break;
        case 0x63: name = 'プロパティ値通知要求'; break;

        case 0x64:
        case 0x65:
        case 0x66:
        case 0x67:
        case 0x68:
        case 0x69:
        case 0x6A:
        case 0x6B:
        case 0x6C:
        case 0x6D:
            name = 'For future reserved';
            break;

        case 0x71: name = 'プロパティ値書き込み応答'; break;
        case 0x72: name = 'プロパティ値読み出し応答'; break;
        case 0x73: name = 'プロパティ値通知'; break;
        case 0x74: name = 'プロパティ値通知（応答要）'; break;

        case 0x75:
        case 0x76:
        case 0x77:
        case 0x78:
        case 0x79:
        case 0x7B:
        case 0x7C:
        case 0x7D:
        case 0x7F:
            name = 'For future reserved';
            break;

        case 0x7A: name = 'プロパティ値通知応答'; break;
        case 0x7E: name = 'プロパティ値書き込み・読み出し応答'; break;
    }

    return name;
}

module.exports = {
    EchonetObject: EchonetObject,
    Frame: Frame,
}