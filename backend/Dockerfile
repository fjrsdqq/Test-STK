FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/menu-tree-server ./cmd/server

FROM alpine:3.21
RUN apk add --no-cache ca-certificates && addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --from=build /out/menu-tree-server ./menu-tree-server
COPY migrations ./migrations
USER app
EXPOSE 8080
CMD ["./menu-tree-server"]
