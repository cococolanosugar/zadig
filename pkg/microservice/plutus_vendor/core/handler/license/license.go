/*
Copyright 2021 The KodeRover Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package license

import (
	"github.com/gin-gonic/gin"

	internalhandler "github.com/koderover/zadig/v2/pkg/shared/handler"
)

type LicenseResponse struct {
	Type             string   `json:"type"`
	Status           string   `json:"status"`
	SystemID         string   `json:"system_id"`
	UserLimit        int      `json:"user_limit"`
	UserCount        int      `json:"user_count"`
	License          string   `json:"license"`
	ExpireAt         int64    `json:"expire_at"`
	AvailableVersion string   `json:"available_version"`
	CurrentVersion   string   `json:"current_version"`
	Features         []string `json:"features"`
	ImprovementPlan  bool     `json:"improvement_plan"`
	BigLogo          string   `json:"big_logo"`
	BigLightLogo     string   `json:"big_light_logo"`
	SmallLogo        string   `json:"small_logo"`
	SmallLightLogo   string   `json:"small_light_logo"`
	Favicon          string   `json:"favicon"`
	CreatedTime      int64    `json:"created_time"`
	UpdatedTime      int64    `json:"updated_time"`
}

func GetLicense(c *gin.Context) {
	ctx := internalhandler.NewContext(c)
	defer func() { internalhandler.JSONResponse(c, ctx) }()

	ctx.Resp = &LicenseResponse{
		Type:             "enterprise",
		Status:           "normal",
		SystemID:         "aea8ace6",
		UserLimit:        1000,
		UserCount:        1,
		License:          "",
		ExpireAt:         0,
		AvailableVersion: "",
		CurrentVersion:   "4.0.0-RELEASE.1",
		Features:         []string{"ai", "sae", "delivery"},
		ImprovementPlan:  true,
		BigLogo:          "",
		BigLightLogo:     "",
		SmallLogo:        "",
		SmallLightLogo:   "",
		Favicon:          "",
		CreatedTime:      0,
		UpdatedTime:      0,
	}
}

type CheckSignatrueResp struct {
	Code int64 `json:"code"`
}

func SignatureCheck(c *gin.Context) {
	ctx := internalhandler.NewContext(c)
	defer func() { internalhandler.JSONResponse(c, ctx) }()

	ctx.Resp = &CheckSignatrueResp{}
}
