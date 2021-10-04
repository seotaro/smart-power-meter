# スマートメーターから電力情報を取得する

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

