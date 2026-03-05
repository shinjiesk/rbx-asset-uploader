--[[
	Roblox Asset Uploader – Studio Bridge Plugin
	Polls the Tauri desktop app's HTTP server and executes commands
	(e.g. creating / updating a ModuleScript with the generated Assets table).
]]

local HttpService = game:GetService("HttpService")

local BRIDGE_URL = "http://127.0.0.1:58750"
local POLL_INTERVAL = 2
local REGISTER_RETRY_INTERVAL = 5

local sessionId = nil

local toolbar = plugin:CreateToolbar("Asset Uploader")
local toggleButton = toolbar:CreateButton(
	"Bridge",
	"Connect to Roblox Asset Uploader desktop app",
	"rbxassetid://0"
)

local isConnected = false
local isRunning = false

local function getPlaceInfo()
	local placeId = game.PlaceId
	local placeName = game.Name
	if placeName == "" or placeName == "Place1" then
		placeName = "Untitled Place"
	end
	return placeId, placeName
end

local function httpGet(url)
	local ok, result = pcall(function()
		return HttpService:GetAsync(url, false)
	end)
	if ok then
		return true, result
	end
	return false, result
end

local function httpPost(url, body)
	local ok, result = pcall(function()
		return HttpService:PostAsync(url, body, Enum.HttpContentType.ApplicationJson, false)
	end)
	if ok then
		return true, result
	end
	return false, result
end

local function findOrCreateInstance(path, className, source)
	local parts = path:split(".")
	if #parts == 0 then
		return nil
	end

	local current = game
	for i, part in ipairs(parts) do
		local child = current:FindFirstChild(part)
		if child then
			current = child
		elseif i == #parts then
			local newInstance = Instance.new(className or "ModuleScript")
			newInstance.Name = part
			newInstance.Parent = current
			current = newInstance
		else
			local folder = Instance.new("Folder")
			folder.Name = part
			folder.Parent = current
			current = folder
		end
	end

	return current
end

local function executeCommand(cmd)
	if cmd.command_type == "set_script" then
		local instance = findOrCreateInstance(cmd.instance_path, "ModuleScript")
		if instance and instance:IsA("LuaSourceContainer") then
			instance.Source = cmd.source
			return true, nil
		else
			return false, "Could not find or create script at: " .. cmd.instance_path
		end
	end
	return false, "Unknown command type: " .. tostring(cmd.command_type)
end

local function register()
	local placeId, placeName = getPlaceInfo()
	local body = HttpService:JSONEncode({
		place_id = placeId,
		place_name = placeName,
	})

	local ok, result = httpPost(BRIDGE_URL .. "/api/register", body)
	if ok then
		local data = HttpService:JSONDecode(result)
		sessionId = data.session_id
		isConnected = true
		print("[AssetUploader] Registered with session:", sessionId)
		return true
	else
		isConnected = false
		return false
	end
end

local function pollLoop()
	while isRunning do
		if not sessionId then
			if not register() then
				task.wait(REGISTER_RETRY_INTERVAL)
				continue
			end
		end

		local ok, result = httpGet(BRIDGE_URL .. "/api/commands/" .. sessionId)
		if ok then
			local data = HttpService:JSONDecode(result)
			if data.commands and #data.commands > 0 then
				for _, cmd in ipairs(data.commands) do
					local success, err = executeCommand(cmd)
					local resultBody = HttpService:JSONEncode({
						success = success,
						error = err,
					})
					httpPost(BRIDGE_URL .. "/api/result/" .. sessionId, resultBody)

					if success then
						print("[AssetUploader] Executed:", cmd.command_type, "->", cmd.instance_path)
					else
						warn("[AssetUploader] Command failed:", err)
					end
				end
			end
		else
			isConnected = false
			sessionId = nil
		end

		task.wait(POLL_INTERVAL)
	end
end

local function startBridge()
	if isRunning then return end
	isRunning = true
	toggleButton:SetActive(true)
	print("[AssetUploader] Bridge started")
	task.spawn(pollLoop)
end

local function stopBridge()
	isRunning = false
	isConnected = false
	sessionId = nil
	toggleButton:SetActive(false)
	print("[AssetUploader] Bridge stopped")
end

toggleButton.Click:Connect(function()
	if isRunning then
		stopBridge()
	else
		startBridge()
	end
end)

startBridge()
