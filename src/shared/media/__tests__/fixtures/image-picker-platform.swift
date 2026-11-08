// UIKit/PhotosUI test doubles. Only dismissal completion is controlled here;
// the Expo delegate under test is compiled unchanged apart from its import.
import Foundation

protocol PHPickerViewControllerDelegate {}
protocol UINavigationControllerDelegate {}
protocol UIImagePickerControllerDelegate {}
protocol UIAdaptivePresentationControllerDelegate {}

class UIViewController: NSObject {
  var presentationController: UIPresentationController? = UIPresentationController()
  private var completion: (() -> Void)?
  private(set) var dismissals = 0

  func dismiss(animated: Bool, completion: (() -> Void)? = nil) {
    dismissals += 1
    self.completion = completion
  }

  func finishDismissal() {
    let done = completion
    completion = nil
    done?()
  }
}

class UIPresentationController {
  var delegate: UIAdaptivePresentationControllerDelegate?
}
class UIImagePickerController: UIViewController {
  var delegate: UIImagePickerControllerDelegate?
}
class PHPickerViewController: UIViewController {
  var delegate: PHPickerViewControllerDelegate?
}
class UINavigationController: UIViewController {}
struct PHPickerResult { let id: Int }
typealias MediaInfo = [String: Int]
struct StatusBarVisibilityController {
  func maybeRestoreStatusBarVisibility() {}
  func maybePreserveVisibilityAndHideStatusBar(_ hide: Bool) {}
}
