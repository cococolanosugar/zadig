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

package organization

import (
	"encoding/base64"
	"sync"

	"github.com/gin-gonic/gin"

	internalhandler "github.com/koderover/zadig/v2/pkg/shared/handler"
	e "github.com/koderover/zadig/v2/pkg/tool/errors"
)

const (
	bigDarkLogoSVG  = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64"><rect width="240" height="64" rx="12" fill="#0066ff"/><circle cx="34" cy="32" r="18" fill="#fff"/><path d="M25 23h18L31 41h18" fill="none" stroke="#0066ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><text x="62" y="41" fill="#fff" font-family="Arial,sans-serif" font-size="27" font-weight="700">Zadig</text></svg>`
	bigLightLogoSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64"><rect width="240" height="64" rx="12" fill="#fff"/><circle cx="34" cy="32" r="18" fill="#0066ff"/><path d="M25 23h18L31 41h18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><text x="62" y="41" fill="#1f2937" font-family="Arial,sans-serif" font-size="27" font-weight="700">Zadig</text></svg>`
	smallLogoSVG    = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0066ff"/><path d="M18 19h30L27 45h30" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
)

// Organization is the enterprise information consumed by the enterprise settings page.
type Organization struct {
	Name         string `json:"name"`
	Website      string `json:"website"`
	OrgToken     string `json:"orgToken"`
	BigLightLogo string `json:"big_light_logo"`
	BigLogo      string `json:"big_logo"`
	SmallLogo    string `json:"small_logo"`
	Favicon      string `json:"favicon"`
}

var organizationStore = struct {
	sync.RWMutex
	value Organization
}{
	value: defaultOrganization(),
}

func svgDataURL(svg string) string {
	return "data:image/svg+xml;base64," + base64.StdEncoding.EncodeToString([]byte(svg))
}

func defaultOrganization() Organization {
	smallLogo := svgDataURL(smallLogoSVG)
	return Organization{
		Name:         "Zadig Enterprise",
		Website:      "https://www.koderover.com",
		OrgToken:     "demo-organization-token",
		BigLightLogo: svgDataURL(bigDarkLogoSVG),
		BigLogo:      svgDataURL(bigLightLogoSVG),
		SmallLogo:    smallLogo,
		Favicon:      smallLogo,
	}
}

func currentOrganization() Organization {
	organizationStore.RLock()
	defer organizationStore.RUnlock()

	return organizationStore.value
}

func saveOrganization(value Organization) {
	organizationStore.Lock()
	defer organizationStore.Unlock()

	organizationStore.value = value
}

func GetOrganization(c *gin.Context) {
	ctx := internalhandler.NewContext(c)
	defer func() { internalhandler.JSONResponse(c, ctx) }()

	ctx.Resp = currentOrganization()
}

func UpdateOrganization(c *gin.Context) {
	ctx := internalhandler.NewContext(c)
	defer func() { internalhandler.JSONResponse(c, ctx) }()

	request := new(Organization)
	if err := c.ShouldBindJSON(request); err != nil {
		ctx.RespErr = e.ErrInvalidParam.AddErr(err)
		return
	}

	saveOrganization(*request)
	ctx.Resp = currentOrganization()
}
