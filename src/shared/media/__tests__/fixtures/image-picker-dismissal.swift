class PickingObserver: OnMediaPickingResultHandler {
  var events: [String] = []
  func didPickMultipleMedia(selection: [PHPickerResult]) {
    // Synchronous processing models a fast local image: there is no async
    // processing delay to accidentally mask an early callback.
    events.append("library:\(selection[0].id)")
  }
  func didPickMedia(mediaInfo: MediaInfo) { events.append("camera:\(mediaInfo["id"]!)") }
  func didCancelPicking() { events.append("cancel") }
}

let observer = PickingObserver()
let handler = ImagePickerHandler(onMediaPickingResultHandler: observer, hideStatusBarWhenPresented: false)
let scenario = CommandLine.arguments[1]

func require(_ condition: Bool, _ message: String) {
  if !condition {
    print("FAIL: \(message)")
    exit(1)
  }
}

switch scenario {
case "library", "repeat-library":
  let count = scenario == "repeat-library" ? 3 : 1
  for id in 0..<count {
    let picker = PHPickerViewController()
    handler.picker(picker, didFinishPicking: [PHPickerResult(id: id)])
    require(observer.events.count == id, "local image \(id) delivered before native dismissal completed")
    require(picker.dismissals == 1, "picker must be dismissed once")
    picker.finishDismissal()
    require(observer.events.last == "library:\(id)", "selection must arrive after dismissal")
    require(observer.events.count == id + 1, "each selection must arrive once")
  }
case "camera":
  let picker = UIImagePickerController()
  handler.imagePickerController(picker, didFinishPickingMediaWithInfo: ["id": 7])
  require(observer.events.isEmpty, "camera image delivered before native dismissal completed")
  picker.finishDismissal()
  require(observer.events == ["camera:7"], "camera result must arrive after dismissal")
case "cancel-library":
  let picker = PHPickerViewController()
  handler.picker(picker, didFinishPicking: [])
  require(observer.events.isEmpty, "library cancellation delivered before dismissal completed")
  picker.finishDismissal()
  require(observer.events == ["cancel"], "library cancellation must arrive once")
case "cancel-camera":
  let picker = UIImagePickerController()
  handler.imagePickerControllerDidCancel(picker)
  require(observer.events.isEmpty, "camera cancellation delivered before dismissal completed")
  picker.finishDismissal()
  require(observer.events == ["cancel"], "camera cancellation must arrive once")
case "interactive-cancel":
  handler.presentationControllerDidDismiss(UIPresentationController())
  require(observer.events == ["cancel"], "interactive dismissal must still cancel")
default:
  fatalError("Unknown scenario")
}
print("PASS: \(scenario)")
