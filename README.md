# BP35A1 を使って、スマートメーターから電力情報を取得する

スマートメータには Bルート※、通信規格は Wi-SUN（Wireless Smart Utility Network）で接続する。電力会社への申し込みと対応する通信モジュールが必要となる。

※ スマートメーターから先の通信経路は A と B の二つがあって、Aルートは電力会社、Bルートは宅内への経路。

## 準備

### Bルートサービスの申し込み

管轄の電力会社に「[電力メーター情報発信サービス（Bルートサービス）](https://www.tepco.co.jp/pg/consignment/liberalization/smartmeter-broute.html)」（リンクは東京電力）を申し込んで認証IDとパスワードを取得する。

### 通信モジュール購入

Wi-SUN に対応するモジュールの選択肢は少なく、DIY で使う場合には ROHM 社製 BP35A1 の一択、これをホストマシンからシリアル接続して使用する。
取り扱い店も極めて少ないが [チップワンストップ](https://www.chip1stop.com/view/dispDetail/DispDetail?partId=ROHM-0154248) で購入した。
通信モジュールと合わせてアダプターボードも購入すること。

- BP35A1（通信モジュール）
- BP35A7（アダプターボード）
- BP35A7-accessories（ピンヘッダ、固定ネジ類）

![通信モジュール](https://user-images.githubusercontent.com/46148606/202370575-542cd52e-a8bf-411e-ad23-4edded3281b4.jpeg)

### 通信モジュール確認

通信モジュールとアダプターボードを組み立てたら、実行したコマンドに応答することを確認しておく。

例）macOS の場合

USB-シリアル変換アダプターを使って、Mac の USBポートに接続する。

![PXL_20221117_080545892](https://user-images.githubusercontent.com/46148606/202397333-ed5eb1c5-74a8-4ab8-be07-71820e56ac5c.jpg)

![PXL_20221117_080706299](https://user-images.githubusercontent.com/46148606/202397344-af7109dd-7f0e-4a47-94b3-09edf842b6cd.jpg)

デバイス名を確認して、screen コマンドで接続する。

```bash
ls /dev/tty.*                  
/dev/tty.Aaaaaaaa   /dev/tty.Bbbbbbbbbbb
/dev/tty.Ccccccccc /dev/tty.usbserial-Xxxxxxxx

screen /dev/tty.usbserial-Xxxxxxxx 115200
```

試しに SKVER コマンド、SKINFO コマンドを実行して、それぞれ応答があることを確認する。

```bash
SKVER
EVER 1.2.10
OK
SKINFO
EINFO XXXX:AAAA:BBBB:CCCC:YYYY:DDDD:EEEE:FFFF GGGGGGGGGGGGGGGG HH IIII JJJJ
OK
```

※ EINFO の XXXX と YYYY がテクニカルリファレンスのユーザーIDとパスワード。

※ screen コマンドの終了は ⌃a + ⌃k と入力する

## インストール

```bash
yarn install
```

## 設定

カレントディレクトリの .env に定義する。

|  項目  |  値  |  内容  |
| ---- | ---- | ---- |
|  ID  |  文字列  |  Bルートサービスの認証ID  |
|  PASSWORD  |  文字列 |  Bルートサービスのパスワード  |
|  DURATION  |  整数  |  アクティブスキャンのスキャン時間  |
|  INSTANTANEOUS_POWER_INTERVAL  |  整数  |  瞬時電力計測値 取得間隔 [ms] |
|  ACCUMLATED_POWER_INTERVAL  |  整数  |  積算電力量計測値 取得間隔 [ms] |
|  SERIAL_PORT  |  文字列  |  シリアルポート  |

.env 例）

```text
ID=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
PASSWORD=XXXXXXXXXXXX
DURATION=6
INSTANTANEOUS_POWER_INTERVAL=15000
ACCUMLATED_POWER_INTERVAL=60000
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
