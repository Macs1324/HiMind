package command

type Command string

const (
	Help    Command = "COMMAND_HELP"
	Search  Command = "COMMAND_SEARCH"
	Unknown Command = "COMMAND_UNKNOWN"
)

func FromString(s string) Command {
	switch s {
	case "help":
		return Help
	case "search":
		return Search
	default:
		return Unknown
	}
}
