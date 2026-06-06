# warden-osv — OSV.dev advisory service for Techanv Warden.
# Build from the warden-osv directory:
#   docker build -t warden-osv .

FROM golang:1.25-alpine AS build
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /warden-osv ./cmd/warden-osv

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /warden-osv /warden-osv
EXPOSE 9000
USER nonroot
ENTRYPOINT ["/warden-osv"]
