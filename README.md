# BP35A1 を使って、スマートメーターから電力情報を取得する

## インストール

```bash
yarn install
```

## 設定

カレントディレクトリの .env に定義する。

.env 例）

```text
# Bルートサービスの認証ID、パスワード
ID=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
PASSWORD=XXXXXXXXXXXX

# アクティブスキャンのスキャン時間
DURATION=6

# 瞬時電力計測値 取得間隔 [ms]
INSTANTANEOUS_POWER_INTERVAL=15000

# 積算電力量計測値 取得間隔 [ms]
ACCUMLATED_POWER_INTERVAL=60000

# シリアルポート
SERIAL_PORT=/dev/ttyS0
```

## 実行

```bash
node index.js
```

## 参考

- [ECHONET 規格書・仕様書など](https://echonet.jp/spec_g/)
  - [ECHONET Lite規格書 Ver.1.13 （日本語版）](https://echonet.jp/spec_v113_lite/)
  - [低圧スマート電力量メータ・HEMSコントローラ間 日本語版 最新Ver.](https://echonet.jp/wp/wp-content/uploads/pdf/General/Standard/AIF/lvsm/lvsm_aif_ver1.01.pdf)
- [BP35A1](https://www.rohm.co.jp/products/wireless-communication/specified-low-power-radio-modules/bp35a1-product#productDetail)