package svc

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	Server  string
	Token   string
	Version string
	HTTP    *http.Client
}

func NewClient(server, token, version string) *Client {
	return &Client{
		Server:  strings.TrimRight(server, "/"),
		Token:   token,
		Version: version,
		HTTP:    &http.Client{Timeout: 20 * time.Second},
	}
}

type PairRequest struct {
	PairToken string `json:"pair_token"`
	Hostname  string `json:"hostname"`
	OS        string `json:"os"`
	Arch      string `json:"arch"`
	Name      string `json:"name,omitempty"`
	Version   string `json:"agent_version"`
}

type PairResponse struct {
	MachineID    string `json:"machine_id"`
	MachineToken string `json:"machine_token"`
	DashboardURL string `json:"dashboard_url"`
	IntervalS    int    `json:"interval_s"`
	Error        string `json:"error,omitempty"`
}

// Pair exchanges a one-time pair token for a long-lived machine token.
func (c *Client) Pair(ctx context.Context, req PairRequest) (*PairResponse, error) {
	req.Version = c.Version
	var resp PairResponse
	status, err := c.post(ctx, "/api/pair", "", req, &resp)
	if err != nil {
		return nil, err
	}
	if status != 200 || resp.MachineToken == "" {
		if resp.Error == "" {
			resp.Error = fmt.Sprintf("HTTP %d", status)
		}
		return nil, errors.New("pairing failed: " + resp.Error)
	}
	return &resp, nil
}

type IngestResponse struct {
	OK        bool   `json:"ok"`
	IntervalS int    `json:"interval_s,omitempty"`
	Error     string `json:"error,omitempty"`
}

// ErrUnauthorized means the machine token was rejected (machine deleted?).
var ErrUnauthorized = errors.New("machine token rejected")

func (c *Client) Report(ctx context.Context, report any) (*IngestResponse, error) {
	var resp IngestResponse
	status, err := c.post(ctx, "/api/ingest", c.Token, report, &resp)
	if err != nil {
		return nil, err
	}
	switch {
	case status == 401 || status == 403:
		return nil, ErrUnauthorized
	case status >= 300:
		if resp.Error == "" {
			resp.Error = fmt.Sprintf("HTTP %d", status)
		}
		return nil, errors.New(resp.Error)
	}
	return &resp, nil
}

func (c *Client) post(ctx context.Context, path, bearer string, body, out any) (int, error) {
	b, err := json.Marshal(body)
	if err != nil {
		return 0, err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", c.Server+path, bytes.NewReader(b))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "vm-vitals-agent/"+c.Version)
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	res, err := c.HTTP.Do(req)
	if err != nil {
		return 0, err
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if out != nil && len(data) > 0 {
		_ = json.Unmarshal(data, out) // non-JSON error pages are fine; status carries it
	}
	return res.StatusCode, nil
}
