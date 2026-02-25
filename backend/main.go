package main

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

type Request struct {
	ID      string          `json:"id"`
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type Response struct {
	ID    string      `json:"id"`
	OK    bool        `json:"ok"`
	Data  interface{} `json:"data,omitempty"`
	Error string      `json:"error,omitempty"`
}

type pidPayload struct {
	PID int `json:"pid"`
}

type loginPayload struct {
	User string `json:"user"`
	Pass string `json:"pass"`
}

func main() {
	scanner := bufio.NewScanner(os.Stdin)
	writer := bufio.NewWriter(os.Stdout)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var req Request
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			_ = writeResponse(writer, Response{
				ID:    "",
				OK:    false,
				Error: fmt.Sprintf("invalid request: %v", err),
			})
			continue
		}

		resp := handle(req)
		_ = writeResponse(writer, resp)
	}

	if err := scanner.Err(); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "stdin scanner error: %v\n", err)
	}
}

func handle(req Request) Response {
	switch req.Type {
	case "SET_PID":
		var payload pidPayload
		if len(req.Payload) > 0 {
			if err := json.Unmarshal(req.Payload, &payload); err != nil {
				return Response{ID: req.ID, OK: false, Error: "invalid SET_PID payload"}
			}
		}
		_ = payload.PID
		return Response{
			ID:   req.ID,
			OK:   true,
			Data: map[string]string{"message": "Handshake Successful"},
		}
	case "SCAN_NFC":
		id, err := randomHex(4)
		if err != nil {
			return Response{ID: req.ID, OK: false, Error: "failed generating NFC ID"}
		}
		return Response{
			ID:   req.ID,
			OK:   true,
			Data: map[string]string{"id": id},
		}
	case "LOGIN":
		var payload loginPayload
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			return Response{ID: req.ID, OK: false, Error: "invalid LOGIN payload"}
		}
		token := fmt.Sprintf("mock.jwt.%s.%d", payload.User, time.Now().UnixNano())
		return Response{
			ID:   req.ID,
			OK:   true,
			Data: map[string]string{"token": token},
		}
	default:
		return Response{
			ID:    req.ID,
			OK:    false,
			Error: "unknown message type",
		}
	}
}

func randomHex(byteLen int) (string, error) {
	buf := make([]byte, byteLen)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func writeResponse(writer *bufio.Writer, resp Response) error {
	payload, err := json.Marshal(resp)
	if err != nil {
		return err
	}
	if _, err := writer.WriteString(string(payload) + "\n"); err != nil {
		return err
	}
	return writer.Flush()
}
