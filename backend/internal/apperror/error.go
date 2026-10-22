package apperror

import "net/http"

type Error struct {
	Code    string
	Message string
	Status  int
}

func (e *Error) Error() string { return e.Message }
func New(status int, code, message string) *Error {
	return &Error{Status: status, Code: code, Message: message}
}
func BadRequest(message string) *Error { return New(http.StatusBadRequest, "BAD_REQUEST", message) }
func InvalidID() *Error                { return New(http.StatusBadRequest, "INVALID_ID", "id must be a valid UUID") }
func NotFound() *Error                 { return New(http.StatusNotFound, "NOT_FOUND", "menu not found") }
func Validation(message string) *Error {
	return New(http.StatusUnprocessableEntity, "VALIDATION_ERROR", message)
}
func Internal() *Error {
	return New(http.StatusInternalServerError, "INTERNAL_ERROR", "an internal error occurred")
}
