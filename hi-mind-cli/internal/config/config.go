package config

import (
	"fmt"
	"log/slog"
	"os"

	"gopkg.in/yaml.v3"
)

type Application struct {
	Endpoint Endpoint `yaml:"endpoint"`
}

type Endpoint struct {
	Host string `yaml:"host"`
	Port string `yaml:"port"`
}

func (x Endpoint) URI() string {
	return fmt.Sprintf("%s:%s", x.Host, x.Port)
}

func Parse() (*Application, error) {
	var cfg Application

	f, err := os.Open("config.yaml")
	if err != nil {
		slog.Error("config: opening config file", "err", err)
		return nil, err
	}
	defer f.Close()

	if err = yaml.NewDecoder(f).Decode(&cfg); err != nil {
		slog.Error("config: decoding config file", "err", err)
		return nil, err
	}

	return &cfg, nil
}
