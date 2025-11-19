FROM ubuntu:22.04 AS builder

RUN apt-get update && apt-get install -y software-properties-common ca-certificates \
  && add-apt-repository ppa:webkit-team/webkitgtk-4.1 -y \
  && apt-get update \
  && apt-get install -y \
  curl \
  build-essential \
  pkg-config \
  libssl-dev \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libjavascriptcoregtk-4.1-dev \
  libsoup-3.0-dev \
  libappindicator3-dev \
  libasound2-dev \
  libxss1 \
  libnss3 \
  libgconf-2-4 \
  libxtst6 \
  libxrandr2 \
  libpangocairo-1.0-0 \
  libatk1.0-dev \
  libcairo-gobject2 \
  libgdk-pixbuf2.0-dev \
  libxkbcommon-dev \
  libsecret-1-dev \
  libatspi2.0-dev \
  && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app
COPY . .
RUN cd src-tauri && cargo build --release --target x86_64-unknown-linux-gnu

FROM ubuntu:22.04

RUN apt-get update && apt-get install -y software-properties-common ca-certificates \
  && add-apt-repository ppa:webkit-team/webkitgtk-4.1 -y \
  && apt-get update \
  && apt-get install -y \
  libgtk-3-0 \
  libwebkit2gtk-4.1-0 \
  libjavascriptcoregtk-4.1-0 \
  libappindicator3-1 \
  libasound2 \
  libxss1 \
  libnss3 \
  libgconf-2-4 \
  libxtst6 \
  libxrandr2 \
  libpangocairo-1.0-0 \
  libatk-bridge2.0-0 \
  libgdk-pixbuf2.0-0 \
  libxkbcommon0 \
  libsecret-1-0 \
  libatspi2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/src-tauri/target/x86_64-unknown-linux-gnu/release/app /usr/local/bin/mintmind

CMD ["/usr/local/bin/mintmind"]