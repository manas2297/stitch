package profile

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strings"

	"stitch/internal/server/helpers"
	"stitch/internal/shell"
)

func HandleGetProfile(w http.ResponseWriter, r *http.Request) {
	var githubUser, githubAvatar, githubEmail string
	var githubBio, githubLocation, githubCompany, githubCreatedAt, githubPlan string
	var githubFollowers, githubFollowing, sshKeyCount int

	userRes := shell.RunCmd(`gh api user --jq '{login: .login, avatar: .avatar_url, email: .email, bio: .bio, followers: .followers, following: .following, location: .location, company: .company, created_at: .created_at, plan: .plan.name}'`, "")
	if userRes.Success && userRes.Stdout != "" {
		var u struct {
			Login     string `json:"login"`
			Avatar    string `json:"avatar"`
			Email     string `json:"email"`
			Bio       string `json:"bio"`
			Followers int    `json:"followers"`
			Following int    `json:"following"`
			Location  string `json:"location"`
			Company   string `json:"company"`
			CreatedAt string `json:"created_at"`
			Plan      string `json:"plan"`
		}
		if err := json.Unmarshal([]byte(userRes.Stdout), &u); err == nil {
			githubUser = u.Login
			githubAvatar = u.Avatar
			githubEmail = u.Email
			githubBio = u.Bio
			githubFollowers = u.Followers
			githubFollowing = u.Following
			githubLocation = u.Location
			githubCompany = u.Company
			githubCreatedAt = u.CreatedAt
			githubPlan = u.Plan
		}
	}

	if sshRes := shell.RunCmd(`gh ssh-key list --json id`, ""); sshRes.Success && sshRes.Stdout != "" && sshRes.Stdout != "[]" {
		var keys []struct {
			ID int `json:"id"`
		}
		if err := json.Unmarshal([]byte(sshRes.Stdout), &keys); err == nil {
			sshKeyCount = len(keys)
		}
	}

	var gitName, gitEmail string
	if res := shell.RunCmd("git config --global user.name", ""); res.Success {
		gitName = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("git config --global user.email", ""); res.Success {
		gitEmail = strings.TrimSpace(res.Stdout)
	}

	emailMismatch := githubEmail != "" && gitEmail != "" &&
		strings.ToLower(strings.TrimSpace(githubEmail)) != strings.ToLower(strings.TrimSpace(gitEmail))

	var gitVer, ghVer string
	if res := shell.RunCmd("git version", ""); res.Success {
		gitVer = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("gh --version | head -1", ""); res.Success {
		ghVer = strings.TrimSpace(res.Stdout)
	}

	detectedOS := runtime.GOOS
	detectedShell := os.Getenv("SHELL")
	if detectedShell == "" {
		detectedShell = "unknown"
	} else {
		parts := strings.Split(detectedShell, "/")
		detectedShell = parts[len(parts)-1]
	}

	runtimes := map[string]string{
		"go":       "Not Installed",
		"node":     "Not Installed",
		"npm":      "Not Installed",
		"python":   "Not Installed",
		"postgres": "Not Installed",
		"mongo":    "Not Installed",
		"redis":    "Not Installed",
		"docker":   "Not Installed",
		"brew":     "Not Installed",
		"bun":      "Not Installed",
		"rust":     "Not Installed",
	}

	if res := shell.RunCmd("go version", ""); res.Success {
		runtimes["go"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("node --version", ""); res.Success {
		runtimes["node"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("npm --version", ""); res.Success {
		runtimes["npm"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("python3 --version", ""); res.Success {
		runtimes["python"] = strings.TrimSpace(res.Stdout)
	} else if res := shell.RunCmd("python --version", ""); res.Success {
		runtimes["python"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("postgres --version", ""); res.Success {
		runtimes["postgres"] = strings.TrimSpace(res.Stdout)
	} else if res := shell.RunCmd("pg_config --version", ""); res.Success {
		runtimes["postgres"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("mongod --version | head -1", ""); res.Success {
		runtimes["mongo"] = strings.TrimSpace(res.Stdout)
	} else if res := shell.RunCmd("mongo --version | head -1", ""); res.Success {
		runtimes["mongo"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("redis-server --version", ""); res.Success {
		parts := strings.Split(res.Stdout, " ")
		if len(parts) >= 3 {
			runtimes["redis"] = parts[0] + " " + parts[1] + " " + parts[2]
		} else {
			runtimes["redis"] = strings.TrimSpace(res.Stdout)
		}
	}
	if res := shell.RunCmd("docker --version", ""); res.Success {
		runtimes["docker"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("brew --version", ""); res.Success {
		lines := strings.Split(strings.TrimSpace(res.Stdout), "\n")
		runtimes["brew"] = lines[0]
	}
	if res := shell.RunCmd("bun --version", ""); res.Success {
		runtimes["bun"] = strings.TrimSpace(res.Stdout)
	}
	if res := shell.RunCmd("rustc --version", ""); res.Success {
		runtimes["rust"] = strings.TrimSpace(res.Stdout)
	}

	helpers.WriteJSONResponse(w, map[string]interface{}{
		"github": map[string]interface{}{
			"username":    githubUser,
			"avatarUrl":   githubAvatar,
			"email":       githubEmail,
			"bio":         githubBio,
			"followers":   githubFollowers,
			"following":   githubFollowing,
			"location":    githubLocation,
			"company":     githubCompany,
			"createdAt":   githubCreatedAt,
			"plan":        githubPlan,
			"sshKeyCount": sshKeyCount,
		},
		"git": map[string]interface{}{
			"globalName":    gitName,
			"globalEmail":   gitEmail,
			"emailMismatch": emailMismatch,
		},
		"diagnostics": map[string]interface{}{
			"gitVersion": strings.TrimPrefix(gitVer, "git version "),
			"ghVersion":  ghVer,
			"os":         detectedOS,
			"shell":      detectedShell,
		},
		"runtimes": runtimes,
	})
}

func HandlePostProfileGit(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		helpers.WriteJSONError(w, "Invalid request payload.", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if body.Name != "" {
		res := shell.RunCmd(fmt.Sprintf(`git config --global user.name "%s"`, body.Name), "")
		if !res.Success {
			helpers.WriteJSONError(w, "Failed to set global Git user.name.", http.StatusInternalServerError)
			return
		}
	}
	if body.Email != "" {
		res := shell.RunCmd(fmt.Sprintf(`git config --global user.email "%s"`, body.Email), "")
		if !res.Success {
			helpers.WriteJSONError(w, "Failed to set global Git user.email.", http.StatusInternalServerError)
			return
		}
	}

	helpers.WriteJSONResponse(w, map[string]interface{}{"success": true, "message": "Global Git identity configured successfully."})
}
