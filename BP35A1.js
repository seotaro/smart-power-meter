'use strict';

const { EventEmitter } = require("events");
const utils = require('./utils');
const echonet = require('./echonet');

// BP35A1 との通信をステートマシンとして表現した。
class BP35A1 extends EventEmitter {
    constructor(port) {
        super();
        this._port = port;          // シリアルポート
        this._state = 'IDLE';
        this._PAN = null;           // 接続先コーディネーターの PAN 情報
        this._address = null;       // 接続先コーディネーターの IPv6 アドレス
        this._isConnected = false;  // PANA による接続が完了したら true にする。
    }

    get state() { return this._state; }
    get isConnected() { return this._isConnected; }
    get address() { return this._address; }
    get port() { return this._port; }

    start() {
        // エコーバックの抑止から通信シーケンススタート。
        this.send(`SKSREG`, 'SFE 0');
    }

    // コマンドを送信する。
    send(command, parameters) {
        // 改行コードが '\r' で他と異なるので、手動で行うコマンド。
        switch (command) {
            case 'WOPT':
            case 'ROPT':
                throw new Error(`${command} command is not supported.`);
                break;
        }

        this._port.write(`${command}${parameters ? ' ' + parameters : ''}\r\n`, (err) => {
            if (err) {
                console.error(err);
                return
            }

            // ステートを更新する。
            switch (command) {
                case 'SKSREG':
                    const SREG = parameters.split(' ')[0];
                    this._state = `SKSREG_${SREG}`;
                    break;

                default:
                    this._state = command;
            }

            console.log(`${command}${parameters ? ' ' + parameters : ''}`);
        });
    }

    // SKSENDTO コマンドで Echonet フレームを送信する。
    sendEchonet(frame) {
        const COMMAND = 'SKSENDTO';
        const HANDLE = '1';     // 送信元 UDP ハンドル
        const PORT = '0E1A';    // ECHONET Lite の UDP ポート 0x0E1A = 3610
        const SEC = '1';        // 暗号化オプション

        const data = frame.toBuffer();
        const length = utils.toHex(data.length, 4);
        const buffer = Buffer.concat([Buffer.from(`${COMMAND} ${HANDLE} ${this._address} ${PORT} ${SEC} ${length} `), data])

        this._port.write(buffer, (err) => {
            if (err) {
                console.error(err);
                return
            }

            // ステートを更新する。
            this._state = COMMAND;

            console.log(`${COMMAND} ${HANDLE} ${this._address} ${PORT} ${SEC} ${length} ${data.toString('hex').toUpperCase()}`);
        });
    }

    dispatch(data) {
        const response = data.split(' ');
        // console.log('RECEIVE', data)

        switch (response[0]) {
            // コマンドのエコーバック
            case 'SKVER':
            case 'SKSETPWD':
            case 'SKSETRBID':
            case 'SKSCAN':
            case 'SKLL64':
            case 'SKSREG':
            case 'SKJOIN':
            case 'SKSREG':
            case 'SKSENDTO':
                break;

            case 'EVER':   // EVER イベント
                console.log(`EVER ${response[1]}`);
                break;

            case 'EPANDESC':   // EPANDESC イベント
                console.log('EPANDESC');
                this._state = 'EPANDESC';
                break;

            case 'EVENT':   // EVENT イベント
                switch (response[1]) {
                    case '01': console.log('EVENT NS を受信した'); break;
                    case '02': console.log('EVENT NA を受信した'); break;
                    case '05': console.log('EVENT Echo Request を受信した'); break;

                    case '1F': console.log('EVENT ED スキャンが完了した'); break;
                    case '20': console.log('EVENT Beacon を受信した'); break;
                    case '21': console.log('EVENT UDP 送信処理が完了した'); break;
                    case '22':
                        console.log(`EVENT アクティブスキャンが完了した。PAN =`, this._PAN);
                        if (this._PAN == null) {
                            const MODE = 2; // アクティブスキャン（Information Element あり）モード
                            const CHANNEL_MASK = 'FFFFFFFF';  // スキャンするチャネルをビットマップフラグで指定
                            this.send(`SKSCAN`, `${MODE} ${CHANNEL_MASK} ${process.env.DURATION}`);

                        } else {
                            this.send(`SKLL64`, `${this._PAN.Addr}`);
                        }
                        break;

                    case '24': console.log('EVENT PANA による接続過程でエラーが発生した（接続が完了しなかった）'); break;
                    case '25':
                        console.log('EVENT PANA による接続が完了した');
                        this._isConnected = true;
                        this._state = 'IDLE';

                        this.emit('connect');
                        break;

                    case '26': console.log('EVENT 接続相手からセッション終了要求を受信した'); break;
                    case '27': console.log('EVENT PANA セッションの終了に成功した'); break;
                    case '28': console.log('EVENT PANA セッションの終了要求に対する応答がなくタイムアウトした（セッションは終了）'); break;
                    case '29': console.log('EVENT セッションのライフタイムが経過して期限切れになった'); break;

                    case '32': console.log('EVENT ARIB108 の送信総和時間の制限が発動した（このイベント以後、あらゆるデータ送信要求が内部で自動的にキャンセルされます）'); break;
                    case '33': console.log('EVENT 送信総和時間の制限が解除された'); break;

                    default: console.error(`EVENT unknown code = ${response}`); break;
                }
                break;

            case 'ERXUDP':   // ERXUDP イベント
                switch (response[3]) {
                    case '02CC': // 送信元ポートが PANA
                        console.log('ERXUDP 送信元 PANA');
                        break;

                    case '0E1A': // 送信元ポートが ECHONET Lite
                        {
                            // 意図しない split がされている可能性があるので、改めてバイナリデータを切り出す。
                            let pos = 0;
                            for (let i = 0; i < 8; i++) {
                                pos += response[i].length + 1;
                            }
                            const frameData = Buffer.from(data.slice(pos), 'binary');

                            const frame = echonet.Frame.from(frameData);

                            console.log(`ERXUDP 送信元 ECHONET Lite [${frame.SEOJ.toString()}]`);

                            // 定時の通知とタイミングが被ると要求した瞬時電力計測値が応答されないっぽいので、
                            // スマート電力量メータから何か応答があればステートをアイドルにしちゃう。
                            if (echonet.EchonetObject.equals(frame.SEOJ, echonet.EchonetObject.PRESET['スマート電力量メータ'])) {
                                this._state = 'IDLE';
                            }

                            this.emit('echonet', frame);
                        }
                        break;

                    default:
                        console.log(`ERXUDP invalid port = ${RPORT}`);
                        break;
                }
                break;

            case 'OK':
                console.log('OK');
                switch (this._state) {
                    case 'SKVER':
                        this.send(`SKSETPWD`, `C ${process.env.PASSWORD}`);
                        break;

                    case 'SKSETPWD':
                        this.send(`SKSETRBID`, `${process.env.ID}`);
                        break;

                    case 'SKSETRBID':
                        {
                            const MODE = 2; // アクティブスキャン（Information Element あり）モード
                            const CHANNEL_MASK = 'FFFFFFFF';  // スキャンするチャネルをビットマップフラグで指定
                            this.send(`SKSCAN`, `${MODE} ${CHANNEL_MASK} ${process.env.DURATION}`);
                        }
                        break;

                    case 'SKSCAN':
                        break;

                    case 'SKSREG_SFE':
                        this.send(`SKVER`);
                        break;

                    case 'SKSREG_S2':
                        this.send(`SKSREG`, `S3 ${this._PAN['Pan ID']}`);
                        break;

                    case 'SKSREG_S3':
                        if (this._address == null) {
                            this.send(`SKLL64`, `${this._PAN.Addr}`);

                        } else {
                            this.send(`SKJOIN`, `${this._address}`);
                        }
                        break;

                    case 'SKJOIN':
                    case 'SKSENDTO':
                        break;

                    default:
                        console.error(`Invalid state: ${this._state}`);
                        break;
                }
                break;

            case 'FAIL':
                switch (response[1]) {
                    case 'ER01': console.error('FAIL reserved'); break;
                    case 'ER02': console.error('FAIL reserved'); break;
                    case 'ER03': console.error('FAIL reserved'); break;
                    case 'ER04': console.error('FAIL 指定されたコマンドがサポートされていない'); break;
                    case 'ER05': console.error('FAIL 指定されたコマンドの引数の数が正しくない'); break;
                    case 'ER06': console.error('FAIL 指定されたコマンドの引数形式や値域が正しくない'); break;
                    case 'ER07': console.error('FAIL reserved'); break;
                    case 'ER08': console.error('FAIL reserved'); break;
                    case 'ER09': console.error('FAIL UART 入力エラーが発生した'); break;
                    case 'ER10': console.error('FAIL 指定されたコマンドは受け付けたが、実行結果が失敗した'); break;
                    default: console.error(`FAIL unknown code = ${response[1]}`); break;
                }
                break;

            default:
                switch (this._state) {
                    case 'EPANDESC':
                        console.log(`${data}`);
                        const attribute = data.trim().split(':');
                        if (this._PAN == null) {
                            this._PAN = {};
                        }
                        this._PAN[attribute[0]] = attribute[1];
                        break;

                    case 'SKLL64':
                        console.log(`${this._PAN.Addr} = ${data}`);
                        this._address = response[0];

                        this.send(`SKSREG`, `S2 ${this._PAN.Channel}`);
                        break;

                    default:
                        console.error(`Invalid response: ${data}`);
                        break;
                }
                break;
        }
    }
}

module.exports = BP35A1;