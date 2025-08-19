package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"hi-mind-cli/internal/command"
	"hi-mind-cli/internal/config"
)

type Result struct {
	Author, Content, Link string
}

func main() {
	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGINT,
	)
	defer stop()

	if len(os.Args) < 3 {
		displayHelp()
		os.Exit(1)
	}
	query := os.Args[2]

	cfg, err := config.Parse()
	if err != nil {
		slog.ErrorContext(ctx, "parsing config", "err", err)
		os.Exit(1)
	}
	url := fmt.Sprintf("http://%s/search?q=%s", cfg.Endpoint.URI(), query)

	switch command.FromString(os.Args[1]) {
	case command.Search:
		slog.InfoContext(ctx, "sending GET request", "URL", url)
		resp, err := http.Get(url)
		if err != nil {
			slog.ErrorContext(ctx, "endpoint returned error", "err", err)
			os.Exit(1)
		}
		defer resp.Body.Close()

		b, err := io.ReadAll(resp.Body)
		if err != nil {
			slog.ErrorContext(ctx, "reading response body", "err", err)
			os.Exit(1)
		}

		var results []Result
		if err = json.Unmarshal(b, &results); err != nil {
			slog.ErrorContext(ctx, "unmarshalling response", "err", err)
			os.Exit(1)
		}

		for _, v := range results {
			fmt.Println(v.Author)
			fmt.Println(v.Content)
			fmt.Println(v.Link)
			fmt.Println()
		}
	default:
		fmt.Fprintf(os.Stdout, "Unrecognized command %s\n", os.Args[1])
		displayHelp()
		os.Exit(1)
	}
}

func displayHelp() {
	help := `COMMANDS:
    search [OPTIONS] - search for knowledge in HiMind!

    OPTIONS:
    -n, --no-experts - omit the expert output.
`
	fmt.Println(help)
}
