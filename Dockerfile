# syntax=docker/dockerfile:1

FROM public.ecr.aws/lambda/nodejs@sha256:bb024a5960c085da558b3b96d62bebc0639d730ca0c82a6012c728623305bf4f AS base

FROM base AS build
WORKDIR /build
COPY package*.json tsconfig*.json ./
RUN npm clean-install --audit=false --fund=false --loglevel=error
COPY ./src ./src
RUN npm run build

FROM base AS deps
WORKDIR /deps
COPY package*.json ./
RUN npm clean-install --audit=false --fund=false --loglevel=error --omit=dev

FROM base AS runtime
WORKDIR "${LAMBDA_TASK_ROOT}"
COPY --from=deps /deps/node_modules ./node_modules
COPY --from=build /build/dist/* ./
COPY rds-ca-global-bundle.pem ./
COPY script.sql.njk ./
CMD ["index.handler"]
