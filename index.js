'use strict';

require('dotenv').config();

const BP35A1 = require('./BP35A1');
const echonet = require('./echonet');

const SerialPort = require('serialport')
const { Readline } = SerialPort.parsers;

const accumlatedPowerParameters = {};   // 積算電力量のパラメーター

const isValidAccumlatedPowerParameters = () => {
    if (accumlatedPowerParameters == null) {
        return false;
    }

    if (accumlatedPowerParameters.factor == null) {
        return false;
    }

    if (accumlatedPowerParameters.digits == null) {
        return false;
    }

    if (accumlatedPowerParameters.unitFactor == null) {
        return false;
    }

    return true
};

const convertAccumlatedPower = (value) => {
    if (!isValidAccumlatedPowerParameters()) {
        throw new Error('invalid accumlated power parameters');
    }

    return value * accumlatedPowerParameters.factor * accumlatedPowerParameters.unitFactor;
};







const port = new SerialPort(process.env.SERIAL_PORT, { autoOpen: true, baudRate: 115200, }, function (err) {
    if (err) {
        return console.log('Error: ', err.message)
    }
})

const bp35a1 = new BP35A1(port);

const parser = port.pipe(new Readline({ delimiter: '\r\n', encoding: 'binary' }));
parser.on('data', data => {
    bp35a1.dispatch(data);
});

bp35a1.on('connect', () => {
    // 積算電力量の係数、単位を取得しておく。
    const frame = echonet.Frame.PRESET['積算電力量パラメーター'];
    bp35a1.sendEchonet(frame);
});

bp35a1.on('echonet', (frame) => {
    if (echonet.EchonetObject.equals(frame.SEOJ, echonet.EchonetObject.PRESET['ノードプロファイル']) && (frame.ESV === 0x73)) {
        // 送信元が プロファイルクラスグループ x ノードプロファイル x 一般ノード で プロパティ値通知

        frame.properties.forEach(property => {
            switch (property.EPC) {
                case 0xD5:
                    {
                        let isSmartPowerMeter = false;

                        const desc = echonet.Frame.parseProperty(frame.SEOJ, property);
                        let EOJs = '';
                        for (let i = 0; i < desc.value.length; i++) {
                            const instance = desc.value[i];
                            if (echonet.EchonetObject.equals(instance, echonet.EchonetObject.PRESET['スマート電力量メータ'])) {
                                isSmartPowerMeter = true;
                            }

                            if (EOJs.length) {
                                EOJs += ', ';
                            }
                            EOJs += `[${instance.toString()}]`;
                        }

                        console.log(`${desc.type} ${EOJs}`);

                        if (!isSmartPowerMeter) {
                            console.error('PAN にスマート電力量メータが存在しない');
                        }
                    }

                    break;
            }
        })

    } else if (echonet.EchonetObject.equals(frame.SEOJ, echonet.EchonetObject.PRESET['スマート電力量メータ'])) {
        // 送信元が 住宅・設備関連機器クラスグループ x 低圧スマート電力量メータ

        frame.properties.forEach(property => {
            const desc = echonet.Frame.parseProperty(frame.SEOJ, property);
            switch (property.EPC) {
                case 0xD3:
                    accumlatedPowerParameters.factor = desc.value;
                    console.log(`${desc.type} ${desc.value}`);
                    break;

                case 0xD7:
                    accumlatedPowerParameters.digits = desc.value;
                    console.log(`${desc.type} ${desc.value} [${desc.unit}]`);
                    break;

                case 0xE0:
                    console.log(`${desc.type} ${convertAccumlatedPower(desc.value)} [kWh]`);
                    break;

                case 0xE1:
                    accumlatedPowerParameters.unitFactor = 1;
                    switch (desc.value) {
                        case 0x00: accumlatedPowerParameters.unitFactor = 1.0; break;
                        case 0x01: accumlatedPowerParameters.unitFactor = 0.1; break;
                        case 0x02: accumlatedPowerParameters.unitFactor = 0.01; break;
                        case 0x03: accumlatedPowerParameters.unitFactor = 0.001; break;
                        case 0x04: accumlatedPowerParameters.unitFactor = 0.0001; break;
                        case 0x0A: accumlatedPowerParameters.unitFactor = 10.0; break;
                        case 0x0B: accumlatedPowerParameters.unitFactor = 100.0; break;
                        case 0x0C: accumlatedPowerParameters.unitFactor = 1000.0; break;
                        case 0x0D: accumlatedPowerParameters.unitFactor = 10000.0; break;
                    }
                    console.log(`${desc.type} ${desc.value}`);
                    break;

                case 0xE7:
                    console.log(`${desc.type} ${desc.value} [${desc.unit}]`);
                    break;

                case 0xEA:
                case 0xEB:
                    console.log(`${desc.type} ${desc.datetime.toISOString()} ${convertAccumlatedPower(desc.value)} [${desc.unit}]`);
                    break;

                default:
                    throw new Error(`invalid EPC = ${property.EPC}`);
                    break;
            }
        })

    } else {
        console.error(`unknown ECHONET frame`);
        console.log(frameData.toString("hex"));
        console.log(frame.toString());
    }
});

// 通信シーケンススタート
bp35a1.start();

// PANA に接続後、繰り返し瞬時電力計測値を取得する。
const readInstantaneousPower = async () => {
    if (bp35a1.isConnected) {
        const frame = echonet.Frame.PRESET['瞬時電力計測値'];
        bp35a1.sendEchonet(frame);
    }
};
setInterval(() => { readInstantaneousPower() }, process.env.INSTANTANEOUS_POWER_INTERVAL);


// PANA に接続後、繰り返し積算電力量計測値（正方向計測値）を取得する。
const readAccumlatedPower = async () => {
    if (bp35a1.isConnected && isValidAccumlatedPowerParameters()) {
        // スマート電力量メータに積算電力量計測値（正方向計測値）を要求する
        const frame = echonet.Frame.PRESET['積算電力量計測値（正方向計測値）'];
        bp35a1.sendEchonet(frame);
    }
};
setInterval(() => { readAccumlatedPower() }, process.env.ACCUMLATED_POWER_INTERVAL);


