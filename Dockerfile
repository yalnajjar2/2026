FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs ./
COPY app.html ./
COPY release/v14 ./release/v14
RUN node ./release/v14/apply.mjs
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["npm","start"]
